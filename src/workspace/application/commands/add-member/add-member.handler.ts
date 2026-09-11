import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AddMemberCommand } from './add-member.command';
import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';
import { MEMBERSHIP_REPOSITORY } from '../../../domain/repositories/membership.repository.interface';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository.interface';
import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(AddMemberCommand)
export class AddMemberHandler implements ICommandHandler<AddMemberCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: AddMemberCommand) {
    const { workspaceId, dto, actorId } = command;

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const actorMembership =
      await this.membershipRepository.findByWorkspaceAndUser(
        workspaceId,
        actorId,
      );

    if (!actorMembership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (dto.role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Owner membership cannot be assigned through this operation',
      );
    }

    const existingMembership =
      await this.membershipRepository.findByWorkspaceAndUser(
        workspaceId,
        dto.userId,
      );

    if (existingMembership) {
      throw new ConflictException('User is already a member of this workspace');
    }

    const membership = await this.membershipRepository.create(
      workspaceId,
      dto.userId,
      dto.role,
    );

    await this.auditService.log({
      actorId,
      action: 'MEMBER_ADDED',
      resource: 'MEMBERSHIP',
      workspaceId,
      meta: {
        memberId: dto.userId,
        role: dto.role,
      },
    });

    return membership;
  }
}
