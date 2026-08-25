import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, Inject } from '@nestjs/common';
import { CreateWorkspaceCommand } from './create-workspace.command';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository.interface';
import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';
import { MEMBERSHIP_REPOSITORY } from '../../../domain/repositories/membership.repository.interface';
import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import { AuditService } from 'src/audit/application/audit.service';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { WorkspaceSettingsService } from '../../services/workspace-settings.service';

@CommandHandler(CreateWorkspaceCommand)
export class CreateWorkspaceHandler implements ICommandHandler<CreateWorkspaceCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,

    private readonly auditService: AuditService,

    private readonly featureFlagsService: FeatureFlagsService,

    private readonly workspaceSettingsService: WorkspaceSettingsService,
  ) {}

  async execute(command: CreateWorkspaceCommand) {
    const { dto, ownerId } = command;

    const existingWorkspace = await this.workspaceRepository.findBySlug(
      dto.slug,
    );

    if (existingWorkspace) {
      throw new ConflictException('Workspace slug already exists');
    }

    const workspace = await this.workspaceRepository.create(
      dto.name,
      dto.slug,
      ownerId,
    );

    const workspaceId = workspace._id.toString();

    await this.membershipRepository.create(
      workspace._id.toString(),
      ownerId,
      WorkspaceRole.OWNER,
    );

    await this.featureFlagsService.createDefaultConfiguration(workspaceId);

    await this.workspaceSettingsService.createDefaultSettings(workspaceId);

    await this.auditService.log({
      actorId: ownerId,
      action: 'WORKSPACE_CREATED',
      resource: 'WORKSPACE',
      workspaceId,
    });

    return workspace;
  }
}
