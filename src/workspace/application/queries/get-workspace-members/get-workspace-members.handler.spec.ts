import { NotFoundException } from '@nestjs/common';
import { GetWorkspaceMembersHandler } from './get-workspace-members.handler';
import { GetWorkspaceMembersQuery } from './get-workspace-members.query';

describe('GetWorkspaceMembersHandler', () => {
  let handler: GetWorkspaceMembersHandler;

  let membershipRepository: {
    findByWorkspaceAndUser: jest.Mock;
    findByWorkspace: jest.Mock;
  };

  const workspaceId = 'workspace-123';
  const userId = 'user-123';

  const activeMembership = {
    _id: 'membership-123',
    workspaceId,
    userId,
    status: 'ACTIVE',
  };

  const inactiveMembership = {
    _id: 'membership-123',
    workspaceId,
    userId,
    status: 'INACTIVE',
  };

  const members = [
    {
      _id: 'membership-1',
      workspaceId,
      userId: 'user-123',
      status: 'ACTIVE',
      role: 'OWNER',
    },
    {
      _id: 'membership-2',
      workspaceId,
      userId: 'user-456',
      status: 'ACTIVE',
      role: 'MEMBER',
    },
  ];

  beforeEach(() => {
    membershipRepository = {
      findByWorkspaceAndUser: jest.fn(),
      findByWorkspace: jest.fn(),
    };

    handler = new GetWorkspaceMembersHandler(membershipRepository as any);
  });

  describe('execute', () => {
    it('should be defined', () => {
      expect(handler).toBeDefined();
    });

    it('should verify the requesting user membership', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      membershipRepository.findByWorkspace.mockResolvedValue(members);

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      await handler.execute(query);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledTimes(
        1,
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
    });

    it('should throw NotFoundException when the user is not a member', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        new NotFoundException('Workspace not found'),
      );

      expect(membershipRepository.findByWorkspace).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the membership is inactive', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        inactiveMembership,
      );

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        new NotFoundException('Workspace not found'),
      );

      expect(membershipRepository.findByWorkspace).not.toHaveBeenCalled();
    });

    it('should find all workspace members after verifying active membership', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      membershipRepository.findByWorkspace.mockResolvedValue(members);

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      await handler.execute(query);

      expect(membershipRepository.findByWorkspace).toHaveBeenCalledTimes(1);
      expect(membershipRepository.findByWorkspace).toHaveBeenCalledWith(
        workspaceId,
      );
    });

    it('should return all workspace members', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      membershipRepository.findByWorkspace.mockResolvedValue(members);

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      const result = await handler.execute(query);

      expect(result).toEqual(members);
    });

    it('should return an empty array when the workspace has no members', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      membershipRepository.findByWorkspace.mockResolvedValue([]);

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      const result = await handler.execute(query);

      expect(result).toEqual([]);
    });

    it('should return the exact result from findByWorkspace', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );

      membershipRepository.findByWorkspace.mockResolvedValue(members);

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      const result = await handler.execute(query);

      expect(result).toBe(members);
    });

    it('should not fetch workspace members when the requesting user is inactive', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        inactiveMembership,
      );

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Workspace not found',
      );

      expect(membershipRepository.findByWorkspace).not.toHaveBeenCalled();
    });

    it('should propagate errors from findByWorkspaceAndUser', async () => {
      const error = new Error('Failed to find membership');

      membershipRepository.findByWorkspaceAndUser.mockRejectedValue(error);

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to find membership',
      );

      expect(membershipRepository.findByWorkspace).not.toHaveBeenCalled();
    });

    it('should propagate errors from findByWorkspace', async () => {
      const error = new Error('Failed to find workspace members');

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );

      membershipRepository.findByWorkspace.mockRejectedValue(error);

      const query = new GetWorkspaceMembersQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to find workspace members',
      );

      expect(membershipRepository.findByWorkspace).toHaveBeenCalledWith(
        workspaceId,
      );
    });
  });
});
