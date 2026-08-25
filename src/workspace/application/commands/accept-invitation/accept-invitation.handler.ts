import {
  ConflictException,
  ForbiddenException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { Connection } from 'mongoose';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'crypto';
import { InjectConnection } from '@nestjs/mongoose';
import { AcceptInvitationCommand } from './accept-invitation.command';

import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository.interface';
import type { IInvitationRepository } from '../../../domain/repositories/invitation.repository.interface';

import { MEMBERSHIP_REPOSITORY } from '../../../domain/repositories/membership.repository.interface';
import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';

import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import type { IUserRepository } from '../../../../users/domain/repositories/user.repository.interface';

import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';

import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationHandler implements ICommandHandler<AcceptInvitationCommand> {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,

    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    private readonly auditService: AuditService,

    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async execute(command: AcceptInvitationCommand) {
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

    const existingMembership =
      await this.membershipRepository.findByWorkspaceAndUser(
        invitation.workspaceId.toString(),
        userId,
      );

    if (existingMembership) {
      throw new ConflictException('You are already a member of this workspace');
    }

    const session = await this.connection.startSession();

    try {
      const membership = await session.withTransaction(async () => {
        const createdMembership = await this.membershipRepository.create(
          invitation.workspaceId.toString(),
          userId,
          invitation.role,
          session,
        );

        await this.invitationRepository.markAccepted(
          invitation._id.toString(),
          session,
        );

        await this.auditService.log(
          {
            actorId: userId,
            action: 'INVITATION_ACCEPTED',
            resource: 'INVITATION',
            workspaceId: invitation.workspaceId.toString(),
            meta: {
              role: invitation.role,
            },
          },
          session,
        );

        return createdMembership;
      });

      return membership;
    } finally {
      await session.endSession();
    }
  }
}
