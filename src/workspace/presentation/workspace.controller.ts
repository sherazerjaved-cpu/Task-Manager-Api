import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Patch,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateWorkspaceDto } from '../application/dto/create-workspace.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { CreateWorkspaceCommand } from '../application/commands/create-workspace/create-workspace.command';
import { GetWorkspacesQuery } from '../application/queries/get-workspaces/get-workspaces.query';
import { GetWorkspaceQuery } from '../application/queries/get-workspace/get-workspace.query';
import { GetWorkspaceMembersQuery } from '../application/queries/get-workspace-members/get-workspace-members.query';
import { AddMemberDto } from '../application/dto/add-member.dto';
import { AddMemberCommand } from '../application/commands/add-member/add-member.command';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { CheckPolicies } from 'src/common/authorization/check-policies.decorator';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';
import { createWorkspacePolicy } from 'src/common/authorization/policies/create-workspace.policy';
import { readWorkspacePolicy } from 'src/common/authorization/policies/read-workspace.policy';
import { manageMemberPolicy } from 'src/common/authorization/policies/manage-member.policy';
import { readMemberPolicy } from 'src/common/authorization/policies/read-member.policy';
import { GlobalPolicy } from 'src/common/authorization/check-policies.decorator';
import { GetAuditLogsDto } from 'src/audit/application/dto/get-audit-logs.dto';
import { readAuditLogPolicy } from 'src/common/authorization/policies/read-audit-log.policy';
import { GetWorkspaceAuditLogsQuery } from 'src/audit/application/queries/get-workspace-audit-logs/get-workspace-audit-logs.query';
import { IdempotencyInterceptor } from 'src/common/idempotency/idempotency.interceptor';
import {
  ApiBearerAuth,
  ApiTags,
  ApiResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { ApiIdempotencyKey } from 'src/common/http/api-headers.decorator';
import { ProblemResponses } from 'src/common/http/problem-responses.decorator';
import { GetFeatureFlagsQuery } from '../application/queries/get-feature-flags/get-feature-flags.query';
import { manageFeatureFlagsPolicy } from 'src/common/authorization/policies/manage-feature-flags.policy';
import { UpdateFeatureFlagsDto } from '../application/dto/update-feature-flags.dto';
import { UpdateFeatureFlagsCommand } from '../application/commands/update-feature-flags/update-feature-flags.command';
import { GetWorkspaceSettingsQuery } from '../application/queries/get-workspace-settings/get-workspace-settings.query';
import { UpdateWorkspaceSettingsDto } from '../application/dto/update-workspace-settings.dto';
import { UpdateWorkspaceSettingsCommand } from '../application/commands/update-workspace-settings/update-workspace-settings.command';
import { updateWorkspaceSettingsPolicy } from 'src/common/authorization/policies/update-workspace-settings.policy';

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@ProblemResponses()
@Controller({ path: 'workspaces', version: '1' })
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new workspace',
    description:
      'Creates a workspace and makes the authenticated user its owner.',
  })
  @ApiResponse({
    status: 201,
    description: 'Workspace created successfully.',
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
    status: 409,
    description: 'Workspace slug already exists.',
  })
  @ApiIdempotencyKey()
  @UseInterceptors(IdempotencyInterceptor)
  @UseGuards(PoliciesGuard)
  @GlobalPolicy()
  @CheckPolicies(createWorkspacePolicy)
  async create(@Body() dto: CreateWorkspaceDto, @Req() req: any) {
    return this.commandBus.execute(
      new CreateWorkspaceCommand(dto, req.user.userId),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all workspaces',
    description: 'Returns all workspaces accessible to the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspaces retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  async findAll(@Req() req: any) {
    return this.queryBus.execute(new GetWorkspacesQuery(req.user.userId));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a workspace by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace retrieved successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid workspace ID.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to access this workspace.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readWorkspacePolicy)
  async findOne(@Param('id', ParseObjectIdPipe) id: string, @Req() req: any) {
    return this.queryBus.execute(new GetWorkspaceQuery(id, req.user.userId));
  }

  @Get(':id/feature-flags')
  @ApiOperation({
    summary: 'Get workspace feature flags',
    description:
      'Returns the feature flags configured for the specified workspace.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace feature flags retrieved successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid workspace ID.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to access this workspace.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readWorkspacePolicy)
  async getFeatureFlags(@Param('id', ParseObjectIdPipe) id: string) {
    return this.queryBus.execute(new GetFeatureFlagsQuery(id));
  }

  @Get(':id/members')
  @ApiOperation({
    summary: 'Get workspace members',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace members retrieved successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid workspace ID.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to view workspace members.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readMemberPolicy)
  async getMembers(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: any,
  ) {
    return this.queryBus.execute(
      new GetWorkspaceMembersQuery(id, req.user.userId),
    );
  }

  @Post(':id/members')
  @ApiOperation({
    summary: 'Add a member to a workspace',
  })
  @ApiResponse({
    status: 201,
    description: 'Workspace member added successfully.',
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
    description: 'User is not allowed to manage workspace members.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @ApiResponse({
    status: 409,
    description:
      'User is already a member or the operation conflicts with the current workspace state.',
  })
  @ApiIdempotencyKey()
  @UseInterceptors(IdempotencyInterceptor)
  @UseGuards(PoliciesGuard)
  @CheckPolicies(manageMemberPolicy)
  async addMember(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddMemberDto,
    @Req() req: any,
  ) {
    return this.commandBus.execute(
      new AddMemberCommand(id, dto, req.user.userId),
    );
  }

  @Get(':id/audit-logs')
  @ApiOperation({
    summary: 'Get workspace audit logs',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace audit logs retrieved successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid workspace ID or query parameters.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to view audit logs.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readAuditLogPolicy)
  async getAuditLogs(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: GetAuditLogsDto,
    @Req() req: any,
  ) {
    return this.queryBus.execute(
      new GetWorkspaceAuditLogsQuery(
        id,
        req.user.userId,
        query.page,
        query.limit,
      ),
    );
  }

  @Patch(':id/feature-flags')
  @ApiOperation({
    summary: 'Update workspace feature flags',
    description:
      'Updates one or more feature flags for the specified workspace.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace feature flags updated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or invalid workspace ID.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not allowed to manage feature flags for this workspace.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @UseGuards(PoliciesGuard)
  @CheckPolicies(manageFeatureFlagsPolicy)
  async updateFeatureFlags(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateFeatureFlagsDto,
  ) {
    return this.commandBus.execute(new UpdateFeatureFlagsCommand(id, dto));
  }

  @Get(':id/settings')
  @ApiOperation({
    summary: 'Get workspace settings',
    description: 'Returns the settings configured for the specified workspace.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace settings retrieved successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid workspace ID.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to access this workspace settings.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readWorkspacePolicy)
  async getSettings(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: any,
  ) {
    return this.queryBus.execute(
      new GetWorkspaceSettingsQuery(id, req.user.userId),
    );
  }

  @Patch(':id/settings')
  @ApiOperation({
    summary: 'Update workspace settings',
    description: 'Updates one or more settings for the specified workspace.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace settings updated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or invalid workspace ID.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to manage workspace settings.',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found.',
  })
  @UseGuards(PoliciesGuard)
  @CheckPolicies(updateWorkspaceSettingsPolicy)
  async updateSettings(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateWorkspaceSettingsDto,
    @Req() req: any,
  ) {
    return this.commandBus.execute(
      new UpdateWorkspaceSettingsCommand(id, dto, req.user.userId),
    );
  }
}
