import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CreateWebhookDto } from '../dto/create-webhook.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { manageWebhookPolicy } from 'src/common/authorization/policies/manage-webhook.policy';
import { CheckPolicies } from 'src/common/authorization/check-policies.decorator';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';
import { WebhookService } from '../../application/webhook.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IdempotencyInterceptor } from 'src/common/idempotency/idempotency.interceptor';
import { ApiIdempotencyKey } from 'src/common/http/api-headers.decorator';
import { ProblemResponses } from 'src/common/http/problem-responses.decorator';

@ApiTags('Webhooks')
@ApiBearerAuth('access-token')
@ProblemResponses()
@Controller({ path: 'workspaces/:workspaceId/webhooks', version: '1' })
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a webhook',
    description: 'Creates a webhook for a workspace.',
  })
  @ApiIdempotencyKey()
  @ApiResponse({
    status: 201,
    description: 'Webhook created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to manage webhooks.',
  })
  @ApiResponse({
    status: 409,
    description: 'Webhook creation conflicts with the current state.',
  })
  @UseInterceptors(IdempotencyInterceptor)
  @UseGuards(PoliciesGuard)
  @CheckPolicies(manageWebhookPolicy)
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    const webhook = await this.webhookService.create(
      workspaceId,
      dto.url,
      dto.events,
    );

    const webhookObject = webhook.toObject();

    delete webhookObject.secret;

    return webhookObject;
  }

  @Get()
  @ApiOperation({
    summary: 'Get workspace webhooks',
    description:
      'Retrieves all webhooks registered for the specified workspace.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhooks retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to manage webhooks.',
  })
  @UseGuards(PoliciesGuard)
  @CheckPolicies(manageWebhookPolicy)
  async findAll(@Param('workspaceId') workspaceId: string) {
    return this.webhookService.findByWorkspace(workspaceId);
  }
}
