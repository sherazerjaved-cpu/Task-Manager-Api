import { MongooseCategoryRepository } from './category.repository';

describe('MongooseCategoryRepository', () => {
  let repository: MongooseCategoryRepository;

  let categoryModel: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
  };

  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(() => {
    categoryModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    repository = new MongooseCategoryRepository(
      categoryModel as any,
      cacheManager as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a category and clear the cache', async () => {
      const category = {
        name: 'Development',
        color: '#3498db',
        owner: 'owner-123',
      };

      const createdCategory = {
        _id: 'category-123',
        ...category,
      };

      categoryModel.create.mockResolvedValue(createdCategory);

      const clearCacheSpy = jest
        .spyOn(repository, 'clearCache')
        .mockResolvedValue();

      const result = await repository.create(category);

      expect(categoryModel.create).toHaveBeenCalledTimes(1);
      expect(categoryModel.create).toHaveBeenCalledWith(category);

      expect(clearCacheSpy).toHaveBeenCalledTimes(1);

      expect(result).toBe(createdCategory);
    });

    it('should propagate errors from categoryModel.create', async () => {
      categoryModel.create.mockRejectedValue(
        new Error('Database create failed'),
      );

      await expect(
        repository.create({
          name: 'Development',
          owner: 'owner-123',
        }),
      ).rejects.toThrow('Database create failed');

      expect(categoryModel.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return cached categories when cache exists', async () => {
      const ownerId = 'owner-123';

      const cachedCategories = [
        {
          _id: 'category-1',
          name: 'Development',
          owner: ownerId,
        },
      ];

      cacheManager.get.mockResolvedValue(cachedCategories);

      const result = await repository.findAll(ownerId);

      expect(cacheManager.get).toHaveBeenCalledWith(
        'categories:list:owner-123',
      );

      expect(result).toBe(cachedCategories);

      expect(categoryModel.find).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should query MongoDB when categories are not cached', async () => {
      const ownerId = 'owner-123';

      cacheManager.get.mockResolvedValue(null);

      const categories = [
        {
          _id: 'category-1',
          name: 'Development',
          owner: ownerId,
        },
        {
          _id: 'category-2',
          name: 'Marketing',
          owner: ownerId,
        },
      ];

      const exec = jest.fn().mockResolvedValue(categories);

      categoryModel.find.mockReturnValue({
        exec,
      });

      const result = await repository.findAll(ownerId);

      expect(cacheManager.get).toHaveBeenCalledWith(
        'categories:list:owner-123',
      );

      expect(categoryModel.find).toHaveBeenCalledWith({
        owner: ownerId,
      });

      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toBe(categories);
    });

    it('should cache categories after fetching from MongoDB', async () => {
      const ownerId = 'owner-456';

      cacheManager.get.mockResolvedValue(null);

      const categories = [
        {
          _id: 'category-1',
          name: 'Work',
          owner: ownerId,
        },
      ];

      const exec = jest.fn().mockResolvedValue(categories);

      categoryModel.find.mockReturnValue({
        exec,
      });

      await repository.findAll(ownerId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        'categories:list:owner-456',
        categories,
        60 * 1000,
      );
    });

    it('should return an empty array when no categories exist', async () => {
      const ownerId = 'owner-789';

      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue([]);

      categoryModel.find.mockReturnValue({
        exec,
      });

      const result = await repository.findAll(ownerId);

      expect(result).toEqual([]);

      expect(cacheManager.set).toHaveBeenCalledWith(
        'categories:list:owner-789',
        [],
        60 * 1000,
      );
    });
  });

  describe('findById', () => {
    it('should return a cached category', async () => {
      const ownerId = 'owner-123';
      const categoryId = 'category-123';

      const cachedCategory = {
        _id: categoryId,
        name: 'Development',
        owner: ownerId,
      };

      cacheManager.get.mockResolvedValue(cachedCategory);

      const result = await repository.findById(categoryId, ownerId);

      expect(cacheManager.get).toHaveBeenCalledWith(
        `category:${ownerId}:${categoryId}`,
      );

      expect(result).toBe(cachedCategory);

      expect(categoryModel.findOne).not.toHaveBeenCalled();
    });

    it('should find a category by ID and owner when cache misses', async () => {
      const ownerId = 'owner-123';
      const categoryId = 'category-123';

      cacheManager.get.mockResolvedValue(null);

      const category = {
        _id: categoryId,
        name: 'Development',
        owner: ownerId,
      };

      const exec = jest.fn().mockResolvedValue(category);

      categoryModel.findOne.mockReturnValue({
        exec,
      });

      const result = await repository.findById(categoryId, ownerId);

      expect(categoryModel.findOne).toHaveBeenCalledWith({
        _id: categoryId,
        owner: ownerId,
      });

      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toBe(category);
    });

    it('should cache the category after a successful database lookup', async () => {
      const ownerId = 'owner-456';
      const categoryId = 'category-456';

      cacheManager.get.mockResolvedValue(null);

      const category = {
        _id: categoryId,
        name: 'Marketing',
        owner: ownerId,
      };

      const exec = jest.fn().mockResolvedValue(category);

      categoryModel.findOne.mockReturnValue({
        exec,
      });

      await repository.findById(categoryId, ownerId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `category:${ownerId}:${categoryId}`,
        category,
        60 * 1000,
      );
    });

    it('should not cache when the category does not exist', async () => {
      const ownerId = 'owner-789';
      const categoryId = 'category-789';

      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue(null);

      categoryModel.findOne.mockReturnValue({
        exec,
      });

      const result = await repository.findById(categoryId, ownerId);

      expect(result).toBeNull();

      expect(cacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('findByIdForRole', () => {
    it('should return a cached category for a normal role', async () => {
      const categoryId = 'category-123';
      const ownerId = 'owner-123';
      const role = 'member';

      const cachedCategory = {
        _id: categoryId,
        owner: ownerId,
        name: 'Development',
      };

      cacheManager.get.mockResolvedValue(cachedCategory);

      const result = await repository.findByIdForRole(
        categoryId,
        ownerId,
        role,
      );

      expect(cacheManager.get).toHaveBeenCalledWith(
        `category:role:${role}:${ownerId}:${categoryId}`,
      );

      expect(result).toBe(cachedCategory);

      expect(categoryModel.findOne).not.toHaveBeenCalled();
    });

    it('should restrict normal roles by ownerId', async () => {
      const categoryId = 'category-123';
      const ownerId = 'owner-123';
      const role = 'member';

      cacheManager.get.mockResolvedValue(null);

      const category = {
        _id: categoryId,
        owner: ownerId,
        name: 'Development',
      };

      const exec = jest.fn().mockResolvedValue(category);

      categoryModel.findOne.mockReturnValue({
        exec,
      });

      await repository.findByIdForRole(categoryId, ownerId, role);

      expect(categoryModel.findOne).toHaveBeenCalledWith({
        _id: categoryId,
        owner: ownerId,
      });
    });

    it('should not restrict admin by ownerId', async () => {
      const categoryId = 'category-123';
      const ownerId = 'owner-123';
      const role = 'admin';

      cacheManager.get.mockResolvedValue(null);

      const category = {
        _id: categoryId,
        owner: 'different-owner',
        name: 'Development',
      };

      const exec = jest.fn().mockResolvedValue(category);

      categoryModel.findOne.mockReturnValue({
        exec,
      });

      const result = await repository.findByIdForRole(
        categoryId,
        ownerId,
        role,
      );

      expect(categoryModel.findOne).toHaveBeenCalledWith({
        _id: categoryId,
      });

      expect(result).toBe(category);
    });

    it('should cache a category found by role lookup', async () => {
      const categoryId = 'category-456';
      const ownerId = 'owner-456';
      const role = 'member';

      cacheManager.get.mockResolvedValue(null);

      const category = {
        _id: categoryId,
        owner: ownerId,
        name: 'Work',
      };

      const exec = jest.fn().mockResolvedValue(category);

      categoryModel.findOne.mockReturnValue({
        exec,
      });

      await repository.findByIdForRole(categoryId, ownerId, role);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `category:role:${role}:${ownerId}:${categoryId}`,
        category,
        60 * 1000,
      );
    });

    it('should not cache when role lookup finds nothing', async () => {
      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue(null);

      categoryModel.findOne.mockReturnValue({
        exec,
      });

      const result = await repository.findByIdForRole(
        'category-789',
        'owner-789',
        'member',
      );

      expect(result).toBeNull();

      expect(cacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a category using optimistic concurrency', async () => {
      const id = 'category-123';
      const ownerId = 'owner-123';
      const expectedVersion = 2;

      const categoryUpdate = {
        name: 'Updated Development',
      };

      const updatedCategory = {
        _id: id,
        owner: ownerId,
        name: 'Updated Development',
        __v: 3,
      };

      const exec = jest.fn().mockResolvedValue(updatedCategory);

      categoryModel.findOneAndUpdate.mockReturnValue({
        exec,
      });

      const clearCacheSpy = jest
        .spyOn(repository, 'clearCache')
        .mockResolvedValue();

      const result = await repository.update(
        id,
        ownerId,
        categoryUpdate,
        expectedVersion,
      );

      expect(categoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: id,
          owner: ownerId,
          __v: expectedVersion,
        },
        {
          $set: categoryUpdate,
          $inc: { __v: 1 },
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(exec).toHaveBeenCalledTimes(1);

      expect(clearCacheSpy).toHaveBeenCalledTimes(1);

      expect(result).toBe(updatedCategory);
    });

    it('should return null when the version does not match', async () => {
      const exec = jest.fn().mockResolvedValue(null);

      categoryModel.findOneAndUpdate.mockReturnValue({
        exec,
      });

      const clearCacheSpy = jest
        .spyOn(repository, 'clearCache')
        .mockResolvedValue();

      const result = await repository.update(
        'category-123',
        'owner-123',
        {
          name: 'Updated',
        },
        5,
      );

      expect(result).toBeNull();

      expect(categoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'category-123',
          owner: 'owner-123',
          __v: 5,
        },
        {
          $set: {
            name: 'Updated',
          },
          $inc: {
            __v: 1,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('should propagate update errors', async () => {
      const exec = jest
        .fn()
        .mockRejectedValue(new Error('Database update failed'));

      categoryModel.findOneAndUpdate.mockReturnValue({
        exec,
      });

      await expect(
        repository.update(
          'category-123',
          'owner-123',
          {
            name: 'Updated',
          },
          1,
        ),
      ).rejects.toThrow('Database update failed');
    });
  });

  describe('delete', () => {
    it('should delete a category by ID and owner', async () => {
      const deletedCategory = {
        _id: 'category-123',
        owner: 'owner-123',
        name: 'Development',
      };

      const exec = jest.fn().mockResolvedValue(deletedCategory);

      categoryModel.findOneAndDelete.mockReturnValue({
        exec,
      });

      const clearCacheSpy = jest
        .spyOn(repository, 'clearCache')
        .mockResolvedValue();

      const result = await repository.delete('category-123', 'owner-123');

      expect(categoryModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: 'category-123',
        owner: 'owner-123',
      });

      expect(exec).toHaveBeenCalledTimes(1);

      expect(clearCacheSpy).toHaveBeenCalledTimes(1);

      expect(result).toBe(deletedCategory);
    });

    it('should return null when the category does not exist', async () => {
      const exec = jest.fn().mockResolvedValue(null);

      categoryModel.findOneAndDelete.mockReturnValue({
        exec,
      });

      const clearCacheSpy = jest
        .spyOn(repository, 'clearCache')
        .mockResolvedValue();

      const result = await repository.delete('category-123', 'owner-123');

      expect(result).toBeNull();

      expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('should propagate delete errors', async () => {
      const exec = jest
        .fn()
        .mockRejectedValue(new Error('Database delete failed'));

      categoryModel.findOneAndDelete.mockReturnValue({
        exec,
      });

      await expect(
        repository.delete('category-123', 'owner-123'),
      ).rejects.toThrow('Database delete failed');
    });
  });

  describe('clearCache', () => {
    it('should delete all tracked cache keys', async () => {
      const ownerId = 'owner-123';

      // Cache misses are required here.
      // findAll() and findById() only add keys to
      // categoryCacheKeys after a cache miss.
      cacheManager.get.mockResolvedValue(null);

      const findExec = jest.fn().mockResolvedValue([
        {
          _id: 'category-1',
          owner: ownerId,
        },
      ]);

      categoryModel.find.mockReturnValue({
        exec: findExec,
      });

      const findOneExec = jest.fn().mockResolvedValue({
        _id: 'category-2',
        owner: ownerId,
      });

      categoryModel.findOne.mockReturnValue({
        exec: findOneExec,
      });

      // Tracks:
      // categories:list:owner-123
      await repository.findAll(ownerId);

      // Tracks:
      // category:owner-123:category-2
      await repository.findById('category-2', ownerId);

      await repository.clearCache();

      expect(cacheManager.del).toHaveBeenCalledTimes(2);

      expect(cacheManager.del).toHaveBeenCalledWith(
        'categories:list:owner-123',
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        'category:owner-123:category-2',
      );
    });

    it('should clear the tracked keys after deletion', async () => {
      const ownerId = 'owner-123';

      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue([
        {
          _id: 'category-1',
          owner: ownerId,
        },
      ]);

      categoryModel.find.mockReturnValue({
        exec,
      });

      await repository.findAll(ownerId);

      await repository.clearCache();

      expect(cacheManager.del).toHaveBeenCalledWith(
        'categories:list:owner-123',
      );

      cacheManager.del.mockClear();

      await repository.clearCache();

      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('should do nothing when there are no tracked cache keys', async () => {
      await repository.clearCache();

      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });
});
