import { NotFoundException } from '@nestjs/common';
import { GetWorkspaceHandler } from './get-workspace.handler';
import { GetWorkspaceQuery } from './get-workspace.query';

describe('GetWorkspaceHandler', () => {
  let handler: GetWorkspaceHandler;

  let workspaceRepository: {
    findById: jest.Mock;
  };

  let membershipRepository: {
    findByWorkspaceAndUser: jest.Mock;
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

  const workspace = {
    _id: workspaceId,
    name: 'Test Workspace',
    slug: 'test-workspace',
  };

  beforeEach(() => {
    workspaceRepository = {
      findById: jest.fn(),
    };

    membershipRepository = {
      findByWorkspaceAndUser: jest.fn(),
    };

    handler = new GetWorkspaceHandler(
      workspaceRepository as any,
      membershipRepository as any,
    );
  });

  describe('execute', () => {
    it('should be defined', () => {
      expect(handler).toBeDefined();
    });

    it('should find the membership using workspace ID and user ID', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      workspaceRepository.findById.mockResolvedValue(workspace);

      const query = new GetWorkspaceQuery(workspaceId, userId);

      await handler.execute(query);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledTimes(
        1,
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
    });

    it('should throw NotFoundException when membership does not exist', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const query = new GetWorkspaceQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        new NotFoundException('Workspace not found'),
      );

      expect(workspaceRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when membership is not active', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        inactiveMembership,
      );

      const query = new GetWorkspaceQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        new NotFoundException('Workspace not found'),
      );

      expect(workspaceRepository.findById).not.toHaveBeenCalled();
    });

    it('should find the workspace after verifying active membership', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      workspaceRepository.findById.mockResolvedValue(workspace);

      const query = new GetWorkspaceQuery(workspaceId, userId);

      await handler.execute(query);

      expect(workspaceRepository.findById).toHaveBeenCalledTimes(1);
      expect(workspaceRepository.findById).toHaveBeenCalledWith(workspaceId);
    });

    it('should throw NotFoundException when workspace does not exist', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      workspaceRepository.findById.mockResolvedValue(null);

      const query = new GetWorkspaceQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        new NotFoundException('Workspace not found'),
      );
    });

    it('should return the workspace when membership is active', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      workspaceRepository.findById.mockResolvedValue(workspace);

      const query = new GetWorkspaceQuery(workspaceId, userId);

      const result = await handler.execute(query);

      expect(result).toEqual(workspace);
    });

    it('should return the exact workspace object from the repository', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      workspaceRepository.findById.mockResolvedValue(workspace);

      const query = new GetWorkspaceQuery(workspaceId, userId);

      const result = await handler.execute(query);

      expect(result).toBe(workspace);
    });

    it('should not query the workspace when membership is inactive', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        inactiveMembership,
      );

      const query = new GetWorkspaceQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Workspace not found',
      );

      expect(workspaceRepository.findById).not.toHaveBeenCalled();
    });

    it('should propagate errors from membershipRepository.findByWorkspaceAndUser', async () => {
      const error = new Error('Failed to find membership');

      membershipRepository.findByWorkspaceAndUser.mockRejectedValue(error);

      const query = new GetWorkspaceQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to find membership',
      );

      expect(workspaceRepository.findById).not.toHaveBeenCalled();
    });

    it('should propagate errors from workspaceRepository.findById', async () => {
      const error = new Error('Failed to find workspace');

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        activeMembership,
      );
      workspaceRepository.findById.mockRejectedValue(error);

      const query = new GetWorkspaceQuery(workspaceId, userId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to find workspace',
      );
    });
  });
});
