import { NotFoundException } from '@nestjs/common';
import { GetPendingInvitationsHandler } from './get-pending-invitations.handler';
import { GetPendingInvitationsQuery } from './get-pending-invitations.query';

describe('GetPendingInvitationsHandler', () => {
  let handler: GetPendingInvitationsHandler;

  let invitationRepository: {
    findPendingByEmail: jest.Mock;
  };

  let userRepository: {
    findById: jest.Mock;
  };

  const userId = 'user-123';

  const user = {
    _id: userId,
    email: 'user@example.com',
  };

  const invitations = [
    {
      _id: 'invitation-1',
      email: 'user@example.com',
      workspaceId: 'workspace-123',
      status: 'PENDING',
    },
    {
      _id: 'invitation-2',
      email: 'user@example.com',
      workspaceId: 'workspace-456',
      status: 'PENDING',
    },
  ];

  beforeEach(() => {
    invitationRepository = {
      findPendingByEmail: jest.fn(),
    };

    userRepository = {
      findById: jest.fn(),
    };

    handler = new GetPendingInvitationsHandler(
      invitationRepository as any,
      userRepository as any,
    );
  });

  describe('execute', () => {
    it('should be defined', () => {
      expect(handler).toBeDefined();
    });

    it('should find the user by user ID', async () => {
      userRepository.findById.mockResolvedValue(user);
      invitationRepository.findPendingByEmail.mockResolvedValue(invitations);

      const query = new GetPendingInvitationsQuery(userId);

      await handler.execute(query);

      expect(userRepository.findById).toHaveBeenCalledTimes(1);
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      const query = new GetPendingInvitationsQuery(userId);

      await expect(handler.execute(query)).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(invitationRepository.findPendingByEmail).not.toHaveBeenCalled();
    });

    it('should find pending invitations using the user email', async () => {
      userRepository.findById.mockResolvedValue(user);
      invitationRepository.findPendingByEmail.mockResolvedValue(invitations);

      const query = new GetPendingInvitationsQuery(userId);

      await handler.execute(query);

      expect(invitationRepository.findPendingByEmail).toHaveBeenCalledTimes(1);
      expect(invitationRepository.findPendingByEmail).toHaveBeenCalledWith(
        user.email,
      );
    });

    it('should return the pending invitations from the repository', async () => {
      userRepository.findById.mockResolvedValue(user);
      invitationRepository.findPendingByEmail.mockResolvedValue(invitations);

      const query = new GetPendingInvitationsQuery(userId);

      const result = await handler.execute(query);

      expect(result).toEqual(invitations);
    });

    it('should return an empty array when there are no pending invitations', async () => {
      userRepository.findById.mockResolvedValue(user);
      invitationRepository.findPendingByEmail.mockResolvedValue([]);

      const query = new GetPendingInvitationsQuery(userId);

      const result = await handler.execute(query);

      expect(result).toEqual([]);
    });

    it('should propagate errors from userRepository.findById', async () => {
      const error = new Error('Failed to find user');

      userRepository.findById.mockRejectedValue(error);

      const query = new GetPendingInvitationsQuery(userId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to find user',
      );

      expect(invitationRepository.findPendingByEmail).not.toHaveBeenCalled();
    });

    it('should propagate errors from invitationRepository.findPendingByEmail', async () => {
      const error = new Error('Failed to find pending invitations');

      userRepository.findById.mockResolvedValue(user);
      invitationRepository.findPendingByEmail.mockRejectedValue(error);

      const query = new GetPendingInvitationsQuery(userId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to find pending invitations',
      );

      expect(invitationRepository.findPendingByEmail).toHaveBeenCalledWith(
        user.email,
      );
    });
  });
});
