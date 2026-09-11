import { InvitationRepository } from './invitation.repository';
import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

describe('InvitationRepository', () => {
  let repository: InvitationRepository;

  let invitationModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    updateOne: jest.Mock;
  };

  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  const workspaceId = '507f1f77bcf86cd799439011';
  const invitationId = '507f1f77bcf86cd799439012';
  const invitedBy = '507f1f77bcf86cd799439013';

  const tokenHash = 'hashed-token';
  const email = 'USER@EXAMPLE.COM';

  const expiresAt = new Date('2026-12-31T00:00:00.000Z');

  const invitation = {
    _id: invitationId,
    workspaceId,
    email: 'user@example.com',
    role: WorkspaceRole.MEMBER,
    tokenHash,
    expiresAt,
    invitedBy,
    status: InvitationStatus.PENDING,
  };

  beforeEach(() => {
    invitationModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateOne: jest.fn(),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    repository = new InvitationRepository(
      invitationModel as any,
      cacheManager as any,
    );
  });

  describe('create', () => {
    it('should create an invitation with the correct arguments', async () => {
      invitationModel.create.mockResolvedValue(invitation);

      const result = await repository.create(
        workspaceId,
        email,
        WorkspaceRole.MEMBER,
        tokenHash,
        expiresAt,
        invitedBy,
      );

      expect(invitationModel.create).toHaveBeenCalledTimes(1);

      const createArg = invitationModel.create.mock.calls[0][0];

      expect(createArg.workspaceId).toEqual(
        expect.objectContaining({
          _bsontype: 'ObjectId',
        }),
      );

      expect(createArg.email).toBe('user@example.com');
      expect(createArg.role).toBe(WorkspaceRole.MEMBER);
      expect(createArg.tokenHash).toBe(tokenHash);
      expect(createArg.expiresAt).toBe(expiresAt);

      expect(createArg.invitedBy).toEqual(
        expect.objectContaining({
          _bsontype: 'ObjectId',
        }),
      );

      expect(result).toBe(invitation);
    });

    it('should clear the cache after creating an invitation', async () => {
      invitationModel.create.mockResolvedValue(invitation);

      // Register a cache key directly.
      (repository as any).invitationCacheKeys.add(
        'invitations:pending:email:user@example.com',
      );

      await repository.create(
        workspaceId,
        email,
        WorkspaceRole.MEMBER,
        tokenHash,
        expiresAt,
        invitedBy,
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        'invitations:pending:email:user@example.com',
      );
    });

    it('should propagate errors from invitationModel.create', async () => {
      const error = new Error('Database error');

      invitationModel.create.mockRejectedValue(error);

      await expect(
        repository.create(
          workspaceId,
          email,
          WorkspaceRole.MEMBER,
          tokenHash,
          expiresAt,
          invitedBy,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('findByTokenHash', () => {
    it('should find an invitation by token hash', async () => {
      const exec = jest.fn().mockResolvedValue(invitation);

      const select = jest.fn().mockReturnValue({
        exec,
      });

      invitationModel.findOne.mockReturnValue({
        select,
      });

      const result = await repository.findByTokenHash(tokenHash);

      expect(invitationModel.findOne).toHaveBeenCalledWith({
        tokenHash,
      });

      expect(select).toHaveBeenCalledWith('+tokenHash');
      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toBe(invitation);
    });

    it('should return null when invitation does not exist', async () => {
      const exec = jest.fn().mockResolvedValue(null);

      invitationModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      const result = await repository.findByTokenHash(tokenHash);

      expect(result).toBeNull();
    });

    it('should propagate errors from invitationModel.findOne', async () => {
      const error = new Error('Database error');

      const exec = jest.fn().mockRejectedValue(error);

      invitationModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      await expect(repository.findByTokenHash(tokenHash)).rejects.toThrow(
        error,
      );
    });
  });

  describe('findPendingByEmail', () => {
    it('should return cached invitations when cache exists', async () => {
      cacheManager.get.mockResolvedValue([invitation]);

      const result = await repository.findPendingByEmail(email);

      expect(cacheManager.get).toHaveBeenCalledWith(
        'invitations:pending:email:user@example.com',
      );

      expect(result).toEqual([invitation]);
      expect(invitationModel.find).not.toHaveBeenCalled();
    });

    it('should query the database when cache is empty', async () => {
      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue([invitation]);

      invitationModel.find.mockReturnValue({
        exec,
      });

      const result = await repository.findPendingByEmail(email);

      expect(invitationModel.find).toHaveBeenCalledWith({
        email: 'user@example.com',
        status: InvitationStatus.PENDING,
      });

      expect(exec).toHaveBeenCalledTimes(1);
      expect(result).toEqual([invitation]);
    });

    it('should cache database results', async () => {
      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue([invitation]);

      invitationModel.find.mockReturnValue({
        exec,
      });

      await repository.findPendingByEmail(email);

      expect(cacheManager.set).toHaveBeenCalledWith(
        'invitations:pending:email:user@example.com',
        [invitation],
        30 * 1000,
      );
    });

    it('should normalize the email to lowercase', async () => {
      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue([]);

      invitationModel.find.mockReturnValue({
        exec,
      });

      await repository.findPendingByEmail('USER@EXAMPLE.COM');

      expect(invitationModel.find).toHaveBeenCalledWith({
        email: 'user@example.com',
        status: InvitationStatus.PENDING,
      });
    });

    it('should propagate errors from cacheManager.get', async () => {
      const error = new Error('Cache error');

      cacheManager.get.mockRejectedValue(error);

      await expect(repository.findPendingByEmail(email)).rejects.toThrow(error);
    });

    it('should propagate errors from invitationModel.find', async () => {
      cacheManager.get.mockResolvedValue(null);

      const error = new Error('Database error');

      const exec = jest.fn().mockRejectedValue(error);

      invitationModel.find.mockReturnValue({
        exec,
      });

      await expect(repository.findPendingByEmail(email)).rejects.toThrow(error);
    });
  });

  describe('findPendingByWorkspace', () => {
    it('should return cached invitations when cache exists', async () => {
      cacheManager.get.mockResolvedValue([invitation]);

      const result = await repository.findPendingByWorkspace(workspaceId);

      expect(cacheManager.get).toHaveBeenCalledWith(
        `invitations:pending:workspace:${workspaceId}`,
      );

      expect(result).toEqual([invitation]);
      expect(invitationModel.find).not.toHaveBeenCalled();
    });

    it('should query the database when cache is empty', async () => {
      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue([invitation]);

      invitationModel.find.mockReturnValue({
        exec,
      });

      const result = await repository.findPendingByWorkspace(workspaceId);

      expect(invitationModel.find).toHaveBeenCalledWith({
        workspaceId: expect.objectContaining({
          _bsontype: 'ObjectId',
        }),
        status: InvitationStatus.PENDING,
      });

      expect(exec).toHaveBeenCalledTimes(1);
      expect(result).toEqual([invitation]);
    });

    it('should cache database results', async () => {
      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue([invitation]);

      invitationModel.find.mockReturnValue({
        exec,
      });

      await repository.findPendingByWorkspace(workspaceId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `invitations:pending:workspace:${workspaceId}`,
        [invitation],
        30 * 1000,
      );
    });

    it('should propagate errors from invitationModel.find', async () => {
      cacheManager.get.mockResolvedValue(null);

      const error = new Error('Database error');

      const exec = jest.fn().mockRejectedValue(error);

      invitationModel.find.mockReturnValue({
        exec,
      });

      await expect(
        repository.findPendingByWorkspace(workspaceId),
      ).rejects.toThrow(error);
    });
  });

  describe('updateStatus', () => {
    it('should update the invitation status', async () => {
      const updatedInvitation = {
        ...invitation,
        status: InvitationStatus.DECLINED,
      };

      invitationModel.findByIdAndUpdate.mockResolvedValue(updatedInvitation);

      const result = await repository.updateStatus(
        invitationId,
        InvitationStatus.DECLINED,
      );

      expect(invitationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        invitationId,
        {
          status: InvitationStatus.DECLINED,
        },
        {
          new: true,
        },
      );

      expect(result).toEqual(updatedInvitation);
    });

    it('should clear the cache after updating status', async () => {
      (repository as any).invitationCacheKeys.add(
        'invitations:pending:email:user@example.com',
      );

      invitationModel.findByIdAndUpdate.mockResolvedValue(invitation);

      await repository.updateStatus(invitationId, InvitationStatus.ACCEPTED);

      expect(cacheManager.del).toHaveBeenCalledWith(
        'invitations:pending:email:user@example.com',
      );
    });

    it('should return null when the invitation does not exist', async () => {
      invitationModel.findByIdAndUpdate.mockResolvedValue(null);

      const result = await repository.updateStatus(
        invitationId,
        InvitationStatus.ACCEPTED,
      );

      expect(result).toBeNull();
    });

    it('should propagate errors from invitationModel.findByIdAndUpdate', async () => {
      const error = new Error('Database error');

      invitationModel.findByIdAndUpdate.mockRejectedValue(error);

      await expect(
        repository.updateStatus(invitationId, InvitationStatus.ACCEPTED),
      ).rejects.toThrow(error);
    });
  });

  describe('markAccepted', () => {
    it('should mark a pending invitation as accepted', async () => {
      invitationModel.updateOne.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      });

      await repository.markAccepted(invitationId);

      expect(invitationModel.updateOne).toHaveBeenCalledWith(
        {
          _id: invitationId,
          status: InvitationStatus.PENDING,
        },
        {
          $set: {
            status: InvitationStatus.ACCEPTED,
          },
        },
        {
          session: undefined,
        },
      );
    });

    it('should pass the MongoDB session when provided', async () => {
      invitationModel.updateOne.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      });

      const session = {} as any;

      await repository.markAccepted(invitationId, session);

      expect(invitationModel.updateOne).toHaveBeenCalledWith(
        {
          _id: invitationId,
          status: InvitationStatus.PENDING,
        },
        {
          $set: {
            status: InvitationStatus.ACCEPTED,
          },
        },
        {
          session,
        },
      );
    });

    it('should clear the cache after accepting the invitation', async () => {
      (repository as any).invitationCacheKeys.add(
        'invitations:pending:workspace:test',
      );

      invitationModel.updateOne.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      });

      await repository.markAccepted(invitationId);

      expect(cacheManager.del).toHaveBeenCalledWith(
        'invitations:pending:workspace:test',
      );
    });

    it('should propagate errors from invitationModel.updateOne', async () => {
      const error = new Error('Database error');

      invitationModel.updateOne.mockRejectedValue(error);

      await expect(repository.markAccepted(invitationId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('markDeclined', () => {
    it('should mark a pending invitation as declined', async () => {
      invitationModel.updateOne.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      });

      await repository.markDeclined(invitationId);

      expect(invitationModel.updateOne).toHaveBeenCalledWith(
        {
          _id: invitationId,
          status: InvitationStatus.PENDING,
        },
        {
          $set: {
            status: InvitationStatus.DECLINED,
          },
        },
      );
    });

    it('should clear the cache after declining the invitation', async () => {
      (repository as any).invitationCacheKeys.add(
        'invitations:pending:email:test@example.com',
      );

      invitationModel.updateOne.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      });

      await repository.markDeclined(invitationId);

      expect(cacheManager.del).toHaveBeenCalledWith(
        'invitations:pending:email:test@example.com',
      );
    });

    it('should propagate errors from invitationModel.updateOne', async () => {
      const error = new Error('Database error');

      invitationModel.updateOne.mockRejectedValue(error);

      await expect(repository.markDeclined(invitationId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('cache invalidation', () => {
    it('should clear all tracked cache keys', async () => {
      const emailCacheKey = 'invitations:pending:email:user@example.com';

      const workspaceCacheKey = `invitations:pending:workspace:${workspaceId}`;

      (repository as any).invitationCacheKeys.add(emailCacheKey);

      (repository as any).invitationCacheKeys.add(workspaceCacheKey);

      invitationModel.create.mockResolvedValue(invitation);

      await repository.create(
        workspaceId,
        email,
        WorkspaceRole.MEMBER,
        tokenHash,
        expiresAt,
        invitedBy,
      );

      expect(cacheManager.del).toHaveBeenCalledTimes(2);

      expect(cacheManager.del).toHaveBeenCalledWith(emailCacheKey);
      expect(cacheManager.del).toHaveBeenCalledWith(workspaceCacheKey);

      expect((repository as any).invitationCacheKeys.size).toBe(0);
    });
  });
});
