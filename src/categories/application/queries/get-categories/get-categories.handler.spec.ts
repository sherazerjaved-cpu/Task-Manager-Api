import { GetCategoriesHandler } from './get-categories.handler';
import { GetCategoriesQuery } from './get-categories.query';

import type { ICategoryRepository } from '../../../domain/repositories/category.repository.interface';

describe('GetCategoriesHandler', () => {
  let handler: GetCategoriesHandler;
  let categoryRepository: jest.Mocked<ICategoryRepository>;
  let findAllMock: jest.Mock;

  beforeEach(() => {
    findAllMock = jest.fn();

    categoryRepository = {
      findAll: findAllMock,
    } as unknown as jest.Mocked<ICategoryRepository>;

    handler = new GetCategoriesHandler(categoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return categories belonging to the owner', async () => {
      const ownerId = 'owner-123';

      const query = new GetCategoriesQuery(ownerId);

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

      findAllMock.mockResolvedValue(categories as any);

      const result = await handler.execute(query);

      expect(findAllMock).toHaveBeenCalledTimes(1);

      expect(findAllMock).toHaveBeenCalledWith(ownerId);

      expect(result).toBe(categories);
    });

    it('should return an empty array when the owner has no categories', async () => {
      const ownerId = 'owner-456';

      const query = new GetCategoriesQuery(ownerId);

      findAllMock.mockResolvedValue([]);

      const result = await handler.execute(query);

      expect(findAllMock).toHaveBeenCalledWith(ownerId);

      expect(result).toEqual([]);
    });

    it('should use the ownerId from the query', async () => {
      const query = new GetCategoriesQuery('owner-789');

      findAllMock.mockResolvedValue([]);

      await handler.execute(query);

      expect(findAllMock).toHaveBeenCalledWith('owner-789');
    });

    it('should propagate repository errors', async () => {
      const query = new GetCategoriesQuery('owner-123');

      findAllMock.mockRejectedValue(new Error('Failed to fetch categories'));

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to fetch categories',
      );

      expect(findAllMock).toHaveBeenCalledTimes(1);
    });
  });
});
