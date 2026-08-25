import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Connection, ClientSession } from 'mongoose';
import { createHash } from 'crypto';

import { AcceptInvitationHandler } from './accept-invitation.handler';
import { AcceptInvitationCommand } from './accept-invitation.command';

import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';

describe('AcceptInvitationHandler', () => {
  let handler: AcceptInvitationHandler;

  let invitationRepository: {
    findByTokenHash: jest.Mock;
    markAccepted: jest.Mock;
  };

  let membershipRepository: {
    findByWorkspaceAndUser: jest.Mock;
    create: jest.Mock;
  };

  let userRepository: {
    findById: jest.Mock;
  };

  let auditService: {
    log: jest.Mock;
  };

  let connection: {
    startSession: jest.Mock;
  };

  let session: {
    withTransaction: jest.Mock;
    endSession: jest.Mock;
  };

  const token = 'invitation-token-123';
  const userId = 'user-123';
  const workspaceId = 'workspace-123';

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const invitationId = 'invitation-123';

  const invitation = {
    _id: {
      toString: () => invitationId,
    },
    workspaceId: {
      toString: () => workspaceId,
    },
    email: 'user@example.com',
    role: 'MEMBER',
    status: InvitationStatus.PENDING,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };

  const user = {
    _id: userId,
    email: 'user@example.com',
  };

  const membership = {
    id: 'membership-123',
    workspaceId,
    userId,
    role: 'MEMBER',
  };

  beforeEach(() => {
    invitationRepository = {
      findByTokenHash: jest.fn(),
      markAccepted: jest.fn(),
    };

    membershipRepository = {
      findByWorkspaceAndUser: jest.fn(),
      create: jest.fn(),
    };

    userRepository = {
      findById: jest.fn(),
    };

    auditService = {
      log: jest.fn(),
    };

    session = {
      withTransaction: jest.fn(),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    connection = {
      startSession: jest.fn().mockResolvedValue(session),
    };

    handler = new AcceptInvitationHandler(
      invitationRepository as any,
      membershipRepository as any,
      userRepository as any,
      auditService as any,
      connection as unknown as Connection,
    );

    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should accept a valid invitation and create membership', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);
      userRepository.findById.mockResolvedValue(user);
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      membershipRepository.create.mockResolvedValue(membership);
      invitationRepository.markAccepted.mockResolvedValue(undefined);
      auditService.log.mockResolvedValue(undefined);

      session.withTransaction.mockImplementation(
        async (callback: (session: ClientSession) => Promise<any>) =>
          callback(session as unknown as ClientSession),
      );

      const command = new AcceptInvitationCommand(token, userId);

      const result = await handler.execute(command);

      expect(result).toEqual(membership);

      expect(invitationRepository.findByTokenHash).toHaveBeenCalledTimes(1);
      expect(invitationRepository.findByTokenHash).toHaveBeenCalledWith(
        tokenHash,
      );

      expect(userRepository.findById).toHaveBeenCalledTimes(1);
      expect(userRepository.findById).toHaveBeenCalledWith(userId);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );

      expect(membershipRepository.create).toHaveBeenCalledWith(
        workspaceId,
        userId,
        invitation.role,
        session,
      );

      expect(invitationRepository.markAccepted).toHaveBeenCalledWith(
        invitationId,
        session,
      );

      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: userId,
          action: 'INVITATION_ACCEPTED',
          resource: 'INVITATION',
          workspaceId,
          meta: {
            role: invitation.role,
          },
        },
        session,
      );

      expect(connection.startSession).toHaveBeenCalledTimes(1);
      expect(session.withTransaction).toHaveBeenCalledTimes(1);
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should hash the invitation token before looking it up', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(null);

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);

      expect(invitationRepository.findByTokenHash).toHaveBeenCalledWith(
        tokenHash,
      );
    });

    it('should throw NotFoundException when invitation does not exist', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(null);

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('Invalid invitation'),
      );

      expect(userRepository.findById).not.toHaveBeenCalled();
      expect(connection.startSession).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);
      userRepository.findById.mockResolvedValue(null);

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();

      expect(connection.startSession).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when invitation email does not match user email', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);

      userRepository.findById.mockResolvedValue({
        ...user,
        email: 'different@example.com',
      });

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(
        new ForbiddenException(
          'This invitation was sent to a different email address',
        ),
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();

      expect(connection.startSession).not.toHaveBeenCalled();
    });

    it('should compare invitation and user emails case-insensitively', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue({
        ...invitation,
        email: 'USER@EXAMPLE.COM',
      });

      userRepository.findById.mockResolvedValue({
        ...user,
        email: 'user@example.com',
      });

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);
      membershipRepository.create.mockResolvedValue(membership);

      session.withTransaction.mockImplementation(
        async (callback: (session: ClientSession) => Promise<any>) =>
          callback(session as unknown as ClientSession),
      );

      const command = new AcceptInvitationCommand(token, userId);

      const result = await handler.execute(command);

      expect(result).toEqual(membership);
    });

    it('should throw ConflictException when invitation is no longer pending', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue({
        ...invitation,
        status: 'ACCEPTED',
      });

      userRepository.findById.mockResolvedValue(user);

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException('Invitation is no longer pending'),
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();

      expect(connection.startSession).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when invitation has expired', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue({
        ...invitation,
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      userRepository.findById.mockResolvedValue(user);

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException('Invitation has expired'),
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();

      expect(connection.startSession).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user is already a workspace member', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);
      userRepository.findById.mockResolvedValue(user);

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(membership);

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException('You are already a member of this workspace'),
      );

      expect(connection.startSession).not.toHaveBeenCalled();

      expect(membershipRepository.create).not.toHaveBeenCalled();
      expect(invitationRepository.markAccepted).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should execute membership creation, invitation acceptance, and audit logging inside a transaction', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);
      userRepository.findById.mockResolvedValue(user);
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      membershipRepository.create.mockResolvedValue(membership);
      invitationRepository.markAccepted.mockResolvedValue(undefined);
      auditService.log.mockResolvedValue(undefined);

      session.withTransaction.mockImplementation(
        async (callback: (session: ClientSession) => Promise<any>) =>
          callback(session as unknown as ClientSession),
      );

      const command = new AcceptInvitationCommand(token, userId);

      await handler.execute(command);

      expect(session.withTransaction).toHaveBeenCalledTimes(1);

      expect(membershipRepository.create).toHaveBeenCalledWith(
        workspaceId,
        userId,
        invitation.role,
        session,
      );

      expect(invitationRepository.markAccepted).toHaveBeenCalledWith(
        invitationId,
        session,
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: userId,
          action: 'INVITATION_ACCEPTED',
          resource: 'INVITATION',
          workspaceId,
        }),
        session,
      );
    });

    it('should always end the MongoDB session after a successful transaction', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);
      userRepository.findById.mockResolvedValue(user);
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);
      membershipRepository.create.mockResolvedValue(membership);

      session.withTransaction.mockImplementation(
        async (callback: (session: ClientSession) => Promise<any>) =>
          callback(session as unknown as ClientSession),
      );

      const command = new AcceptInvitationCommand(token, userId);

      await handler.execute(command);

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should always end the MongoDB session when the transaction fails', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);
      userRepository.findById.mockResolvedValue(user);
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const error = new Error('Transaction failed');

      session.withTransaction.mockRejectedValue(error);

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should not mark the invitation accepted if membership creation fails', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);
      userRepository.findById.mockResolvedValue(user);
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const error = new Error('Membership creation failed');

      session.withTransaction.mockImplementation(
        async (callback: (session: ClientSession) => Promise<any>) =>
          callback(session as unknown as ClientSession),
      );

      membershipRepository.create.mockRejectedValue(error);

      const command = new AcceptInvitationCommand(token, userId);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(invitationRepository.markAccepted).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });
  });
});
