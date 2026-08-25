import { NotFoundException } from '@nestjs/common';

import { GetCategoryHandler } from './get-category.handler';
import { GetCategoryQuery } from './get-category.query';

import type { ICategoryRepository } from '../../../domain/repositories/category.repository.interface';

describe('GetCategoryHandler', () => {
  let handler: GetCategoryHandler;
  let categoryRepository: jest.Mocked<ICategoryRepository>;
  let findByIdMock: jest.Mock;

  beforeEach(() => {
    findByIdMock = jest.fn();

    categoryRepository = {
      findById: findByIdMock,
    } as unknown as jest.Mocked<ICategoryRepository>;

    handler = new GetCategoryHandler(categoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return the category when it exists', async () => {
      const query = new GetCategoryQuery('category-123', 'owner-123');

      const category = {
        _id: 'category-123',
        name: 'Development',
        description: 'Development tasks',
        owner: 'owner-123',
      };

      findByIdMock.mockResolvedValue(category as any);

      const result = await handler.execute(query);

      expect(findByIdMock).toHaveBeenCalledTimes(1);

      expect(findByIdMock).toHaveBeenCalledWith('category-123', 'owner-123');

      expect(result).toBe(category);
    });

    it('should throw NotFoundException when the category does not exist', async () => {
      const query = new GetCategoryQuery('category-123', 'owner-123');

      findByIdMock.mockResolvedValue(null);

      const promise = handler.execute(query);

      await expect(promise).rejects.toThrow(NotFoundException);

      await expect(promise).rejects.toThrow('Category not found');

      expect(findByIdMock).toHaveBeenCalledTimes(1);

      expect(findByIdMock).toHaveBeenCalledWith('category-123', 'owner-123');
    });

    it('should use both the category ID and owner ID from the query', async () => {
      const query = new GetCategoryQuery('category-456', 'owner-456');

      findByIdMock.mockResolvedValue({
        _id: 'category-456',
        owner: 'owner-456',
      } as any);

      await handler.execute(query);

      expect(findByIdMock).toHaveBeenCalledWith('category-456', 'owner-456');
    });

    it('should propagate repository errors', async () => {
      const query = new GetCategoryQuery('category-789', 'owner-789');

      findByIdMock.mockRejectedValue(new Error('Failed to fetch category'));

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to fetch category',
      );

      expect(findByIdMock).toHaveBeenCalledTimes(1);
    });
  });
});
