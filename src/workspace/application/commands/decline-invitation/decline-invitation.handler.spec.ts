import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeclineInvitationHandler } from './decline-invitation.handler';
import { DeclineInvitationCommand } from './decline-invitation.command';
import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';
import type { IInvitationRepository } from '../../../domain/repositories/invitation.repository.interface';
import type { IUserRepository } from '../../../../users/domain/repositories/user.repository.interface';
import { AuditService } from '../../../../audit/application/audit.service';
import { createHash } from 'crypto';

describe('DeclineInvitationHandler', () => {
  let handler: DeclineInvitationHandler;

  let invitationRepository: jest.Mocked<IInvitationRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let auditService: jest.Mocked<AuditService>;

  const token = 'test-invitation-token';
  const userId = 'user-123';
  const workspaceId = 'workspace-123';

  const command = new DeclineInvitationCommand(token, userId);

  const user = {
    _id: userId,
    email: 'user@example.com',
  };

  const invitation = {
    _id: 'invitation-123',
    workspaceId,
    email: 'user@example.com',
    role: 'MEMBER',
    status: InvitationStatus.PENDING,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  beforeEach(() => {
    invitationRepository = {
      findByTokenHash: jest.fn(),
      markDeclined: jest.fn(),
    } as unknown as jest.Mocked<IInvitationRepository>;

    userRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    auditService = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    handler = new DeclineInvitationHandler(
      invitationRepository,
      userRepository,
      auditService,
    );

    invitationRepository.findByTokenHash.mockResolvedValue(invitation as any);

    userRepository.findById.mockResolvedValue(user as any);

    invitationRepository.markDeclined.mockResolvedValue(undefined as any);

    auditService.log.mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should throw NotFoundException when invitation does not exist', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('Invalid invitation'),
      );

      expect(invitationRepository.findByTokenHash).toHaveBeenCalledTimes(1);

      expect(userRepository.findById).not.toHaveBeenCalled();
      expect(invitationRepository.markDeclined).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should find the invitation using the SHA-256 hash of the token', async () => {
      const expectedTokenHash = createHash('sha256')
        .update(token)
        .digest('hex');

      await handler.execute(command);

      expect(invitationRepository.findByTokenHash).toHaveBeenCalledWith(
        expectedTokenHash,
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(userRepository.findById).toHaveBeenCalledWith(userId);

      expect(invitationRepository.markDeclined).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when invitation email does not match user email', async () => {
      userRepository.findById.mockResolvedValue({
        ...user,
        email: 'different@example.com',
      } as any);

      await expect(handler.execute(command)).rejects.toThrow(
        new ForbiddenException(
          'This invitation was sent to a different email address',
        ),
      );

      expect(invitationRepository.markDeclined).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should compare invitation and user emails case-insensitively', async () => {
      userRepository.findById.mockResolvedValue({
        ...user,
        email: 'USER@EXAMPLE.COM',
      } as any);

      await expect(handler.execute(command)).resolves.toEqual({
        message: 'Invitation declined successfully',
      });

      expect(invitationRepository.markDeclined).toHaveBeenCalledWith(
        invitation._id.toString(),
      );
    });

    it('should throw ConflictException when invitation is not pending', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue({
        ...invitation,
        status: InvitationStatus.ACCEPTED,
      } as any);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException('Invitation is no longer pending'),
      );

      expect(invitationRepository.markDeclined).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when invitation has expired', async () => {
      invitationRepository.findByTokenHash.mockResolvedValue({
        ...invitation,
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException('Invitation has expired'),
      );

      expect(invitationRepository.markDeclined).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should mark the invitation as declined', async () => {
      await handler.execute(command);

      expect(invitationRepository.markDeclined).toHaveBeenCalledTimes(1);

      expect(invitationRepository.markDeclined).toHaveBeenCalledWith(
        invitation._id.toString(),
      );
    });

    it('should write an audit log after declining the invitation', async () => {
      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledTimes(1);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: userId,
        action: 'INVITATION_DECLINED',
        resource: 'INVITATION',
        workspaceId: invitation.workspaceId.toString(),
        meta: {
          role: invitation.role,
        },
      });
    });

    it('should return the success message', async () => {
      const result = await handler.execute(command);

      expect(result).toEqual({
        message: 'Invitation declined successfully',
      });
    });

    it('should propagate errors from invitationRepository.findByTokenHash', async () => {
      const error = new Error('Database error');

      invitationRepository.findByTokenHash.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('should propagate errors from userRepository.findById', async () => {
      const error = new Error('User lookup failed');

      userRepository.findById.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(invitationRepository.markDeclined).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should propagate errors from invitationRepository.markDeclined', async () => {
      const error = new Error('Failed to decline invitation');

      invitationRepository.markDeclined.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should propagate errors from auditService.log', async () => {
      const error = new Error('Audit logging failed');

      auditService.log.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(invitationRepository.markDeclined).toHaveBeenCalledWith(
        invitation._id.toString(),
      );
    });
  });
});
