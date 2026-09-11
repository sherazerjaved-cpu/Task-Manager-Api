import { NotFoundException } from '@nestjs/common';

import { DeleteCategoryHandler } from './delete-category.handler';
import { DeleteCategoryCommand } from './delete-category.command';
import type { ICategoryRepository } from '../../../domain/repositories/category.repository.interface';

describe('DeleteCategoryHandler', () => {
  let handler: DeleteCategoryHandler;
  let categoryRepository: jest.Mocked<ICategoryRepository>;
  let deleteMock: jest.Mock;

  beforeEach(() => {
    deleteMock = jest.fn();

    categoryRepository = {
      delete: deleteMock,
    } as unknown as jest.Mocked<ICategoryRepository>;

    handler = new DeleteCategoryHandler(categoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should delete the category for the specified owner', async () => {
      const command = new DeleteCategoryCommand('category-123', 'owner-123');

      const deletedCategory = {
        _id: 'category-123',
        name: 'Development',
        owner: 'owner-123',
      };

      deleteMock.mockResolvedValue(deletedCategory as any);

      const result = await handler.execute(command);

      expect(deleteMock).toHaveBeenCalledTimes(1);

      expect(deleteMock).toHaveBeenCalledWith('category-123', 'owner-123');

      expect(result).toEqual({
        message: 'Category Deleted Successfully',
      });
    });

    it('should throw NotFoundException when the category does not exist', async () => {
      const command = new DeleteCategoryCommand('category-123', 'owner-123');

      deleteMock.mockResolvedValue(null);

      const promise = handler.execute(command);

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Category not found');

      expect(deleteMock).toHaveBeenCalledTimes(1);

      expect(deleteMock).toHaveBeenCalledWith('category-123', 'owner-123');
    });

    it('should propagate repository errors', async () => {
      const command = new DeleteCategoryCommand('category-789', 'owner-789');

      deleteMock.mockRejectedValue(new Error('Failed to delete category'));

      await expect(handler.execute(command)).rejects.toThrow(
        'Failed to delete category',
      );

      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
  });
});
