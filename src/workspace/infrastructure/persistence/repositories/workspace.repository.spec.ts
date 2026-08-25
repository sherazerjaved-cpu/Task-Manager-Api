import { WorkspaceRepository } from './workspace.repository';

describe('WorkspaceRepository', () => {
  let repository: WorkspaceRepository;

  const workspaceId = '68a123456789abcdef123456';
  const ownerId = '68a123456789abcdef123457';

  const workspace = {
    _id: workspaceId,
    name: 'Backend Development',
    slug: 'backend-development',
    owner: ownerId,
  } as any;

  const cacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  } as any;

  const workspaceModel = {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    repository = new WorkspaceRepository(workspaceModel, cacheManager);

    cacheManager.get.mockResolvedValue(null);
    cacheManager.set.mockResolvedValue(undefined);
    cacheManager.del.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('should create a workspace with the correct arguments', async () => {
      workspaceModel.create.mockResolvedValue(workspace);

      const result = await repository.create(
        'Backend Development',
        'backend-development',
        ownerId,
      );

      expect(workspaceModel.create).toHaveBeenCalledWith({
        name: 'Backend Development',
        slug: 'backend-development',
        owner: expect.anything(),
      });

      expect(result).toBe(workspace);
    });

    it('should clear the cache after creating a workspace', async () => {
      workspaceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      // Populate the tracked cache key through the actual repository.
      await repository.findById(workspaceId);

      workspaceModel.create.mockResolvedValue(workspace);

      cacheManager.del.mockResolvedValue(undefined);

      await repository.create(
        'Backend Development',
        'backend-development',
        ownerId,
      );

      expect(cacheManager.del).toHaveBeenCalledWith(`workspace:${workspaceId}`);
    });

    it('should propagate errors from workspaceModel.create', async () => {
      const error = new Error('Database error');

      workspaceModel.create.mockRejectedValue(error);

      await expect(
        repository.create(
          'Backend Development',
          'backend-development',
          ownerId,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('findById', () => {
    it('should return cached workspace when cache exists', async () => {
      cacheManager.get.mockResolvedValue(workspace);

      const result = await repository.findById(workspaceId);

      expect(cacheManager.get).toHaveBeenCalledWith(`workspace:${workspaceId}`);

      expect(workspaceModel.findById).not.toHaveBeenCalled();

      expect(result).toBe(workspace);
    });

    it('should query the database when cache is empty', async () => {
      workspaceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      const result = await repository.findById(workspaceId);

      expect(workspaceModel.findById).toHaveBeenCalledWith(workspaceId);

      expect(result).toBe(workspace);
    });

    it('should cache the workspace when found', async () => {
      workspaceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      await repository.findById(workspaceId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `workspace:${workspaceId}`,
        workspace,
        60 * 1000,
      );
    });

    it('should return null when workspace does not exist', async () => {
      workspaceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.findById(workspaceId);

      expect(result).toBeNull();

      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should propagate errors from workspaceModel.findById', async () => {
      const error = new Error('Database error');

      workspaceModel.findById.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findById(workspaceId)).rejects.toThrow(error);
    });

    it('should propagate errors from cacheManager.get', async () => {
      const error = new Error('Cache error');

      cacheManager.get.mockRejectedValue(error);

      await expect(repository.findById(workspaceId)).rejects.toThrow(error);
    });
  });

  describe('findByOwner', () => {
    it('should return cached workspaces when cache exists', async () => {
      cacheManager.get.mockResolvedValue([workspace]);

      const result = await repository.findByOwner(ownerId);

      expect(cacheManager.get).toHaveBeenCalledWith(
        `workspaces:owner:${ownerId}`,
      );

      expect(workspaceModel.find).not.toHaveBeenCalled();

      expect(result).toEqual([workspace]);
    });

    it('should query the database when cache is empty', async () => {
      workspaceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([workspace]),
      });

      const result = await repository.findByOwner(ownerId);

      expect(workspaceModel.find).toHaveBeenCalledWith({
        owner: expect.anything(),
      });

      expect(result).toEqual([workspace]);
    });

    it('should cache the database results', async () => {
      workspaceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([workspace]),
      });

      await repository.findByOwner(ownerId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `workspaces:owner:${ownerId}`,
        [workspace],
        60 * 1000,
      );
    });

    it('should propagate errors from workspaceModel.find', async () => {
      const error = new Error('Database error');

      workspaceModel.find.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findByOwner(ownerId)).rejects.toThrow(error);
    });
  });

  describe('findByIds', () => {
    const workspaceId2 = '68a123456789abcdef123458';

    it('should return cached workspaces when cache exists', async () => {
      cacheManager.get.mockResolvedValue([workspace]);

      const result = await repository.findByIds([workspaceId]);

      expect(cacheManager.get).toHaveBeenCalledWith(
        `workspaces:ids:${workspaceId}`,
      );

      expect(workspaceModel.find).not.toHaveBeenCalled();

      expect(result).toEqual([workspace]);
    });

    it('should sort ids before generating the cache key', async () => {
      cacheManager.get.mockResolvedValue([workspace]);

      await repository.findByIds([workspaceId2, workspaceId]);

      const expectedKey = [workspaceId, workspaceId2].sort().join(',');

      expect(cacheManager.get).toHaveBeenCalledWith(
        `workspaces:ids:${expectedKey}`,
      );
    });

    it('should query the database when cache is empty', async () => {
      workspaceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([workspace]),
      });

      const result = await repository.findByIds([workspaceId]);

      expect(workspaceModel.find).toHaveBeenCalledWith({
        _id: {
          $in: [expect.anything()],
        },
      });

      expect(result).toEqual([workspace]);
    });

    it('should cache the database results', async () => {
      workspaceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([workspace]),
      });

      await repository.findByIds([workspaceId]);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `workspaces:ids:${workspaceId}`,
        [workspace],
        60 * 1000,
      );
    });

    it('should propagate errors from workspaceModel.find', async () => {
      const error = new Error('Database error');

      workspaceModel.find.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findByIds([workspaceId])).rejects.toThrow(error);
    });
  });

  describe('findBySlug', () => {
    const slug = 'backend-development';

    it('should return cached workspace when cache exists', async () => {
      cacheManager.get.mockResolvedValue(workspace);

      const result = await repository.findBySlug(slug);

      expect(cacheManager.get).toHaveBeenCalledWith(`workspace:slug:${slug}`);

      expect(workspaceModel.findOne).not.toHaveBeenCalled();

      expect(result).toBe(workspace);
    });

    it('should query the database when cache is empty', async () => {
      workspaceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      const result = await repository.findBySlug(slug);

      expect(workspaceModel.findOne).toHaveBeenCalledWith({
        slug,
      });

      expect(result).toBe(workspace);
    });

    it('should cache the workspace when found', async () => {
      workspaceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      await repository.findBySlug(slug);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `workspace:slug:${slug}`,
        workspace,
        60 * 1000,
      );
    });

    it('should return null when workspace does not exist', async () => {
      workspaceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.findBySlug(slug);

      expect(result).toBeNull();

      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should propagate errors from workspaceModel.findOne', async () => {
      const error = new Error('Database error');

      workspaceModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findBySlug(slug)).rejects.toThrow(error);
    });
  });

  describe('clearCache', () => {
    it('should clear all tracked cache keys', async () => {
      workspaceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      workspaceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([workspace]),
      });

      workspaceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      await repository.findById(workspaceId);

      await repository.findByOwner(ownerId);

      await repository.findByIds([workspaceId]);

      await repository.findBySlug('backend-development');

      cacheManager.del.mockClear();

      await repository.clearCache();

      expect(cacheManager.del).toHaveBeenCalledWith(`workspace:${workspaceId}`);

      expect(cacheManager.del).toHaveBeenCalledWith(
        `workspaces:owner:${ownerId}`,
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        `workspaces:ids:${workspaceId}`,
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        `workspace:slug:backend-development`,
      );

      expect(cacheManager.del).toHaveBeenCalledTimes(4);
    });

    it('should clear the tracked cache keys after deletion', async () => {
      workspaceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      await repository.findById(workspaceId);

      await repository.clearCache();

      cacheManager.del.mockClear();

      await repository.clearCache();

      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('should propagate errors from cacheManager.del', async () => {
      workspaceModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(workspace),
      });

      await repository.findById(workspaceId);

      const error = new Error('Cache deletion error');

      cacheManager.del.mockRejectedValue(error);

      await expect(repository.clearCache()).rejects.toThrow(error);
    });
  });
});
