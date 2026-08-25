import {
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
  Get,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AcceptInvitationCommand } from '../../application/commands/accept-invitation/accept-invitation.command';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { DeclineInvitationCommand } from '../../application/commands/decline-invitation/decline-invitation.command';
import { GetPendingInvitationsQuery } from '../../application/queries/get-pending-invitations/get-pending-invitations.query';
import { Body } from '@nestjs/common';
import { CreateInvitationDto } from '../../application/dto/create-invitation.dto';
import { CreateInvitationCommand } from '../../application/commands/create-invitation/create-invitation.command';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { CheckPolicies } from 'src/common/authorization/check-policies.decorator';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';
import { manageInvitationPolicy } from 'src/common/authorization/policies/manage-invitation.policy';
import { IdempotencyInterceptor } from 'src/common/idempotency/idempotency.interceptor';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiIdempotencyKey } from 'src/common/http/api-headers.decorator';
import { ProblemResponses } from 'src/common/http/problem-responses.decorator';

@ApiTags('Invitations')
@ApiBearerAuth('access-token')
@ProblemResponses()
@Controller({ path: 'invitations', version: '1' })
@UseGuards(JwtAuthGuard)
export class InvitationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('pending')
  @ApiOperation({
    summary: 'Get pending invitations',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending invitations retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  async getPendingInvitations(@Req() req: any) {
    return this.queryBus.execute(
      new GetPendingInvitationsQuery(req.user.userId),
    );
  }

  @Post(':workspaceId')
  @ApiOperation({
    summary: 'Create a workspace invitation',
    description:
      'Creates an invitation for a user to join the specified workspace.',
  })
  @ApiIdempotencyKey()
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully.',
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
    description: 'User is not allowed to manage invitations.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @ApiResponse({
    status: 409,
    description:
      'A pending invitation already exists or the request conflicts with the current state.',
  })
  @UseInterceptors(IdempotencyInterceptor)
  @UseGuards(PoliciesGuard)
  @CheckPolicies(manageInvitationPolicy)
  async createInvitation(
    @Param('workspaceId', ParseObjectIdPipe) workspaceId: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: any,
  ) {
    return this.commandBus.execute(
      new CreateInvitationCommand(workspaceId, dto, req.user.userId),
    );
  }

  @Post(':token/accept')
  @ApiOperation({
    summary: 'Accept a workspace invitation',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invitation is invalid, expired, or cannot be accepted.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found.',
  })
  async acceptInvitation(@Param('token') token: string, @Req() req: any) {
    return this.commandBus.execute(
      new AcceptInvitationCommand(token, req.user.userId),
    );
  }

  @Post(':token/decline')
  @ApiOperation({
    summary: 'Decline a workspace invitation',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation declined successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invitation is invalid, expired, or cannot be declined.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found.',
  })
  async declineInvitation(@Param('token') token: string, @Req() req: any) {
    return this.commandBus.execute(
      new DeclineInvitationCommand(token, req.user.userId),
    );
  }
}
