import {
  ConflictException,
  ForbiddenException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'crypto';
import { DeclineInvitationCommand } from './decline-invitation.command';
import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository.interface';
import type { IInvitationRepository } from '../../../domain/repositories/invitation.repository.interface';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import type { IUserRepository } from '../../../../users/domain/repositories/user.repository.interface';
import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(DeclineInvitationCommand)
export class DeclineInvitationHandler implements ICommandHandler<DeclineInvitationCommand> {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,

    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: DeclineInvitationCommand) {
    const { token, userId } = command;

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const invitation =
      await this.invitationRepository.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundException('Invalid invitation');
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('Invitation is no longer pending');
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ConflictException('Invitation has expired');
    }

    await this.invitationRepository.markDeclined(invitation._id.toString());

    await this.auditService.log({
      actorId: userId,
      action: 'INVITATION_DECLINED',
      resource: 'INVITATION',
      workspaceId: invitation.workspaceId.toString(),
      meta: {
        role: invitation.role,
      },
    });

    return {
      message: 'Invitation declined successfully',
    };
  }
}
