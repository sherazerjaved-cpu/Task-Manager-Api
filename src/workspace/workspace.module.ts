import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import {
  Workspace,
  WorkspaceSchema,
} from './infrastructure/persistence/schemas/workspace.schema';
import { WorkspaceRepository } from './infrastructure/persistence/repositories/workspace.repository';
import { WORKSPACE_REPOSITORY } from './domain/repositories/workspace.repository.interface';
import { CreateWorkspaceHandler } from './application/commands/create-workspace/create-workspace.handler';
import { WorkspaceController } from './presentation/workspace.controller';
import { GetWorkspacesHandler } from './application/queries/get-workspaces/get-workspaces.handler';
import { GetWorkspaceHandler } from './application/queries/get-workspace/get-workspace.handler';
import {
  Membership,
  MembershipSchema,
} from './infrastructure/persistence/schemas/membership.schema';
import { MembershipRepository } from './infrastructure/persistence/repositories/membership.repository';
import { MEMBERSHIP_REPOSITORY } from './domain/repositories/membership.repository.interface';
import { GetWorkspaceMembersHandler } from './application/queries/get-workspace-members/get-workspace-members.handler';
import { AddMemberHandler } from './application/commands/add-member/add-member.handler';
import {
  Invitation,
  InvitationSchema,
} from './infrastructure/persistence/schemas/invitation.schema';
import { InvitationRepository } from './infrastructure/persistence/repositories/invitation.repository';
import { INVITATION_REPOSITORY } from './domain/repositories/invitation.repository.interface';
import { AcceptInvitationHandler } from './application/commands/accept-invitation/accept-invitation.handler';
import { InvitationController } from './infrastructure/controllers/invitation.controller';
import { UsersModule } from '../users/users.module';
import { DeclineInvitationHandler } from './application/commands/decline-invitation/decline-invitation.handler';
import { GetPendingInvitationsHandler } from './application/queries/get-pending-invitations/get-pending-invitations.handler';
import { MailModule } from '../mail/mail.module';
import { CreateInvitationHandler } from './application/commands/create-invitation/create-invitation.handler';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';
import { TaskModule } from 'src/task/task.module';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { AuditModule } from 'src/audit/audit.module';
import {
  WorkspaceFeatureFlags,
  WorkspaceFeatureFlagsSchema,
} from './infrastructure/persistence/schemas/workspace-feature-flags.schema';
import { MongooseWorkspaceFeatureFlagsRepository } from './infrastructure/persistence/repositories/workspace-feature-flags.repository';
import { FeatureFlagsService } from './application/services/feature-flags.service';
import { WORKSPACE_FEATURE_FLAGS_REPOSITORY } from './domain/constants/repository.tokens';
import { GetFeatureFlagsHandler } from './application/queries/get-feature-flags/get-feature-flags.handler';
import { UpdateFeatureFlagsHandler } from './application/commands/update-feature-flags/update-feature-flags.handler';
import {
  WorkspaceSettings,
  WorkspaceSettingsSchema,
} from './infrastructure/persistence/schemas/workspace-settings.schema';
import { WorkspaceSettingsRepository } from './infrastructure/persistence/repositories/workspace-settings.repository';
import { WORKSPACE_SETTINGS_REPOSITORY } from './domain/repositories/workspace-settings.repository.interface';
import { WorkspaceSettingsService } from './application/services/workspace-settings.service';
import { GetWorkspaceSettingsHandler } from './application/queries/get-workspace-settings/get-workspace-settings.handler';
import { UpdateWorkspaceSettingsHandler } from './application/commands/update-workspace-settings/update-workspace-settings.handler';

@Module({
  imports: [
    CqrsModule,
    UsersModule,
    MailModule,
    AuditModule,
    AuthorizationModule,
    forwardRef(() => TaskModule),
    MongooseModule.forFeature([
      {
        name: Workspace.name,
        schema: WorkspaceSchema,
      },
      {
        name: Membership.name,
        schema: MembershipSchema,
      },
      {
        name: Invitation.name,
        schema: InvitationSchema,
      },
      {
        name: WorkspaceFeatureFlags.name,
        schema: WorkspaceFeatureFlagsSchema,
      },
      {
        name: WorkspaceSettings.name,
        schema: WorkspaceSettingsSchema,
      },
    ]),
  ],

  controllers: [WorkspaceController, InvitationController],

  providers: [
    WorkspaceRepository,
    {
      provide: WORKSPACE_REPOSITORY,
      useExisting: WorkspaceRepository,
    },
    MembershipRepository,
    {
      provide: MEMBERSHIP_REPOSITORY,
      useExisting: MembershipRepository,
    },
    InvitationRepository,
    {
      provide: INVITATION_REPOSITORY,
      useExisting: InvitationRepository,
    },
    MongooseWorkspaceFeatureFlagsRepository,
    {
      provide: WORKSPACE_FEATURE_FLAGS_REPOSITORY,
      useExisting: MongooseWorkspaceFeatureFlagsRepository,
    },
    WorkspaceSettingsRepository,
    {
      provide: WORKSPACE_SETTINGS_REPOSITORY,
      useExisting: WorkspaceSettingsRepository,
    },
    FeatureFlagsService,
    CreateWorkspaceHandler,
    GetWorkspacesHandler,
    GetWorkspaceHandler,
    GetWorkspaceMembersHandler,
    AddMemberHandler,
    AcceptInvitationHandler,
    DeclineInvitationHandler,
    GetPendingInvitationsHandler,
    CreateInvitationHandler,
    PoliciesGuard,
    GetFeatureFlagsHandler,
    UpdateFeatureFlagsHandler,
    WorkspaceSettingsService,
    GetWorkspaceSettingsHandler,
    UpdateWorkspaceSettingsHandler,
  ],

  exports: [
    WorkspaceRepository,
    WORKSPACE_REPOSITORY,
    MEMBERSHIP_REPOSITORY,
    INVITATION_REPOSITORY,
    FeatureFlagsService,
    WORKSPACE_SETTINGS_REPOSITORY,
  ],
})
export class WorkspaceModule {}
