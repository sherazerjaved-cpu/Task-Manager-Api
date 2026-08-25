import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomBytes, createHash } from 'crypto';
import { CreateInvitationCommand } from './create-invitation.command';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository.interface';
import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';
import { MEMBERSHIP_REPOSITORY } from '../../../domain/repositories/membership.repository.interface';
import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';
import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository.interface';
import type { IInvitationRepository } from '../../../domain/repositories/invitation.repository.interface';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { MailService } from '../../../../mail/mail.service';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(CreateInvitationCommand)
export class CreateInvitationHandler implements ICommandHandler<CreateInvitationCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,

    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,

    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    private readonly mailService: MailService,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateInvitationCommand) {
    const { workspaceId, dto, invitedBy } = command;

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const actorMembership =
      await this.membershipRepository.findByWorkspaceAndUser(
        workspaceId,
        invitedBy,
      );

    if (!actorMembership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (dto.role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Owner role cannot be assigned through an invitation',
      );
    }

    const invitedUser = await this.userRepository.findByEmailWithoutPassword(
      dto.email,
    );

    if (!invitedUser) {
      throw new NotFoundException('User with this email does not exist');
    }

    const existingMembership =
      await this.membershipRepository.findByWorkspaceAndUser(
        workspaceId,
        invitedUser._id.toString(),
      );

    if (existingMembership) {
      throw new ConflictException('User is already a member of this workspace');
    }

    const pendingInvitations =
      await this.invitationRepository.findPendingByEmail(dto.email);

    const alreadyInvited = pendingInvitations.some(
      (invitation) =>
        invitation.workspaceId.toString() === workspaceId.toString(),
    );

    if (alreadyInvited) {
      throw new ConflictException(
        'A pending invitation already exists for this user',
      );
    }

    const rawToken = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const invitation = await this.invitationRepository.create(
      workspaceId,
      dto.email,
      dto.role,
      tokenHash,
      expiresAt,
      invitedBy,
    );

    await this.mailService.sendWorkspaceInvitation(
      dto.email,
      workspace.name,
      rawToken,
      expiresAt,
    );

    await this.auditService.log({
      actorId: invitedBy,
      action: 'INVITATION_CREATED',
      resource: 'INVITATION',
      workspaceId,
      meta: {
        invitedUserId: invitedUser._id.toString(),
        role: dto.role,
      },
    });

    return {
      id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    };
  }
}
