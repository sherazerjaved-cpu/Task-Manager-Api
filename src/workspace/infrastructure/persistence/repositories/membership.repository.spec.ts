import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';

import { MembershipRepository } from './membership.repository';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

describe('MembershipRepository', () => {
  let repository: MembershipRepository;

  let membershipModel: any;
  let cacheManager: any;

  const workspaceId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  const membership = {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(workspaceId),
    userId: new Types.ObjectId(userId),
    role: WorkspaceRole.MEMBER,
  };

  beforeEach(() => {
    membershipModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      exists: jest.fn(),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    repository = new MembershipRepository(membershipModel, cacheManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a membership with the correct arguments', async () => {
      membershipModel.create.mockResolvedValue([membership]);

      const result = await repository.create(
        workspaceId,
        userId,
        WorkspaceRole.MEMBER,
      );

      expect(membershipModel.create).toHaveBeenCalledWith(
        [
          {
            workspaceId: new Types.ObjectId(workspaceId),
            userId: new Types.ObjectId(userId),
            role: WorkspaceRole.MEMBER,
          },
        ],
        { session: undefined },
      );

      expect(result).toBe(membership);
    });

    it('should pass the MongoDB session when provided', async () => {
      membershipModel.create.mockResolvedValue([membership]);

      const session = {} as any;

      await repository.create(
        workspaceId,
        userId,
        WorkspaceRole.ADMIN,
        session,
      );

      expect(membershipModel.create).toHaveBeenCalledWith(
        [
          {
            workspaceId: new Types.ObjectId(workspaceId),
            userId: new Types.ObjectId(userId),
            role: WorkspaceRole.ADMIN,
          },
        ],
        { session },
      );
    });

    it('should clear the cache after creating a membership', async () => {
      cacheManager.get.mockResolvedValue(null);

      membershipModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(membership),
      });

      // This causes the repository to track the cache key.
      await repository.findByWorkspaceAndUser(workspaceId, userId);

      cacheManager.del.mockResolvedValue(undefined);

      membershipModel.create.mockResolvedValue([membership]);

      await repository.create(workspaceId, userId, WorkspaceRole.MEMBER);

      expect(cacheManager.del).toHaveBeenCalledWith(
        `membership:${workspaceId}:${userId}`,
      );
    });

    it('should throw ConflictException for duplicate membership', async () => {
      membershipModel.create.mockRejectedValue({
        code: 11000,
      });

      await expect(
        repository.create(workspaceId, userId, WorkspaceRole.MEMBER),
      ).rejects.toThrow(
        new ConflictException('User is already a member of this workspace'),
      );
    });

    it('should propagate non-duplicate errors from membershipModel.create', async () => {
      const error = new Error('Database error');

      membershipModel.create.mockRejectedValue(error);

      await expect(
        repository.create(workspaceId, userId, WorkspaceRole.MEMBER),
      ).rejects.toThrow(error);
    });
  });

  describe('findByWorkspaceAndUser', () => {
    it('should return the cached membership when cache exists', async () => {
      cacheManager.get.mockResolvedValue(membership);

      const result = await repository.findByWorkspaceAndUser(
        workspaceId,
        userId,
      );

      expect(result).toBe(membership);
      expect(cacheManager.get).toHaveBeenCalledWith(
        `membership:${workspaceId}:${userId}`,
      );
      expect(membershipModel.findOne).not.toHaveBeenCalled();
    });

    it('should query the database when cache is empty', async () => {
      cacheManager.get.mockResolvedValue(null);

      const query = {
        exec: jest.fn().mockResolvedValue(membership),
      };

      membershipModel.findOne.mockReturnValue(query);

      const result = await repository.findByWorkspaceAndUser(
        workspaceId,
        userId,
      );

      expect(membershipModel.findOne).toHaveBeenCalledWith({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
      });

      expect(query.exec).toHaveBeenCalled();
      expect(result).toBe(membership);
    });

    it('should cache the membership when found', async () => {
      cacheManager.get.mockResolvedValue(null);

      const query = {
        exec: jest.fn().mockResolvedValue(membership),
      };

      membershipModel.findOne.mockReturnValue(query);

      await repository.findByWorkspaceAndUser(workspaceId, userId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `membership:${workspaceId}:${userId}`,
        membership,
        30 * 1000,
      );
    });

    it('should not cache when membership does not exist', async () => {
      cacheManager.get.mockResolvedValue(null);

      const query = {
        exec: jest.fn().mockResolvedValue(null),
      };

      membershipModel.findOne.mockReturnValue(query);

      const result = await repository.findByWorkspaceAndUser(
        workspaceId,
        userId,
      );

      expect(result).toBeNull();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should propagate errors from cacheManager.get', async () => {
      const error = new Error('Cache error');

      cacheManager.get.mockRejectedValue(error);

      await expect(
        repository.findByWorkspaceAndUser(workspaceId, userId),
      ).rejects.toThrow(error);
    });

    it('should propagate errors from membershipModel.findOne', async () => {
      cacheManager.get.mockResolvedValue(null);

      const error = new Error('Database error');

      membershipModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(
        repository.findByWorkspaceAndUser(workspaceId, userId),
      ).rejects.toThrow(error);
    });
  });

  describe('findByUser', () => {
    it('should return cached memberships when cache exists', async () => {
      const memberships = [membership];

      cacheManager.get.mockResolvedValue(memberships);

      const result = await repository.findByUser(userId);

      expect(result).toBe(memberships);
      expect(cacheManager.get).toHaveBeenCalledWith(
        `memberships:user:${userId}`,
      );
      expect(membershipModel.find).not.toHaveBeenCalled();
    });

    it('should query the database when cache is empty', async () => {
      cacheManager.get.mockResolvedValue(null);

      const memberships = [membership];

      membershipModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(memberships),
      });

      const result = await repository.findByUser(userId);

      expect(membershipModel.find).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
      });

      expect(result).toBe(memberships);
    });

    it('should cache database results', async () => {
      cacheManager.get.mockResolvedValue(null);

      const memberships = [membership];

      membershipModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(memberships),
      });

      await repository.findByUser(userId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `memberships:user:${userId}`,
        memberships,
        30 * 1000,
      );
    });

    it('should propagate errors from membershipModel.find', async () => {
      cacheManager.get.mockResolvedValue(null);

      const error = new Error('Database error');

      membershipModel.find.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findByUser(userId)).rejects.toThrow(error);
    });
  });

  describe('findByWorkspace', () => {
    it('should return cached memberships when cache exists', async () => {
      const memberships = [membership];

      cacheManager.get.mockResolvedValue(memberships);

      const result = await repository.findByWorkspace(workspaceId);

      expect(result).toBe(memberships);
      expect(cacheManager.get).toHaveBeenCalledWith(
        `memberships:workspace:${workspaceId}`,
      );
      expect(membershipModel.find).not.toHaveBeenCalled();
    });

    it('should query the database when cache is empty', async () => {
      cacheManager.get.mockResolvedValue(null);

      const memberships = [membership];

      membershipModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(memberships),
      });

      const result = await repository.findByWorkspace(workspaceId);

      expect(membershipModel.find).toHaveBeenCalledWith({
        workspaceId: new Types.ObjectId(workspaceId),
      });

      expect(result).toBe(memberships);
    });

    it('should cache database results', async () => {
      cacheManager.get.mockResolvedValue(null);

      const memberships = [membership];

      membershipModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(memberships),
      });

      await repository.findByWorkspace(workspaceId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `memberships:workspace:${workspaceId}`,
        memberships,
        30 * 1000,
      );
    });

    it('should propagate errors from membershipModel.find', async () => {
      cacheManager.get.mockResolvedValue(null);

      const error = new Error('Database error');

      membershipModel.find.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findByWorkspace(workspaceId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('exists', () => {
    it('should return true when membership exists', async () => {
      membershipModel.exists.mockResolvedValue({
        _id: membership._id,
      });

      const result = await repository.exists(workspaceId, userId);

      expect(result).toBe(true);

      expect(membershipModel.exists).toHaveBeenCalledWith({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
      });
    });

    it('should return false when membership does not exist', async () => {
      membershipModel.exists.mockResolvedValue(null);

      const result = await repository.exists(workspaceId, userId);

      expect(result).toBe(false);
    });

    it('should propagate errors from membershipModel.exists', async () => {
      const error = new Error('Database error');

      membershipModel.exists.mockRejectedValue(error);

      await expect(repository.exists(workspaceId, userId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('cache invalidation', () => {
    it('should clear all tracked cache keys', async () => {
      cacheManager.get.mockResolvedValue(null);

      membershipModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(membership),
      });

      membershipModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([membership]),
      });

      // Populate all three tracked cache keys through the actual repository.
      await repository.findByWorkspaceAndUser(workspaceId, userId);

      await repository.findByUser(userId);

      await repository.findByWorkspace(workspaceId);

      cacheManager.del.mockResolvedValue(undefined);

      membershipModel.create.mockResolvedValue([membership]);

      await repository.create(workspaceId, userId, WorkspaceRole.MEMBER);

      expect(cacheManager.del).toHaveBeenCalledWith(
        `membership:${workspaceId}:${userId}`,
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        `memberships:user:${userId}`,
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        `memberships:workspace:${workspaceId}`,
      );

      expect(cacheManager.del).toHaveBeenCalledTimes(3);
    });
  });
});
