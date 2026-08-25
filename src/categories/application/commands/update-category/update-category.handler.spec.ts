import { ConflictException, NotFoundException } from '@nestjs/common';

import { UpdateCategoryHandler } from './update-category.handler';
import { UpdateCategoryCommand } from './update-category.command';

import type { ICategoryRepository } from '../../../domain/repositories/category.repository.interface';
import type { UpdateCategoryDto } from '../../../DTO/update_category.dto';

describe('UpdateCategoryHandler', () => {
  let handler: UpdateCategoryHandler;
  let categoryRepository: jest.Mocked<ICategoryRepository>;
  let findByIdMock: jest.Mock;
  let updateMock: jest.Mock;

  beforeEach(() => {
    findByIdMock = jest.fn();
    updateMock = jest.fn();

    categoryRepository = {
      findById: findByIdMock,
      update: updateMock,
    } as unknown as jest.Mocked<ICategoryRepository>;

    handler = new UpdateCategoryHandler(categoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should update the category when the version matches', async () => {
      const updateCategoryDto = {
        name: 'Updated Development',
        description: 'Updated description',
      } as UpdateCategoryDto;

      const command = new UpdateCategoryCommand(
        'category-123',
        updateCategoryDto,
        'owner-123',
        2,
      );

      const category = {
        _id: 'category-123',
        name: 'Development',
        owner: 'owner-123',
        __v: 2,
      };

      const updatedCategory = {
        ...category,
        name: 'Updated Development',
        description: 'Updated description',
        __v: 3,
      };

      findByIdMock.mockResolvedValue(category as any);
      updateMock.mockResolvedValue(updatedCategory as any);

      const result = await handler.execute(command);

      expect(findByIdMock).toHaveBeenCalledTimes(1);
      expect(findByIdMock).toHaveBeenCalledWith('category-123', 'owner-123');

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledWith(
        'category-123',
        'owner-123',
        updateCategoryDto,
        2,
      );

      expect(result).toBe(updatedCategory);
    });

    it('should throw NotFoundException when the category does not exist', async () => {
      const updateCategoryDto = {
        name: 'Updated Development',
      } as UpdateCategoryDto;

      const command = new UpdateCategoryCommand(
        'category-123',
        updateCategoryDto,
        'owner-123',
        1,
      );

      findByIdMock.mockResolvedValue(null);

      const promise = handler.execute(command);

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Category not found');

      expect(findByIdMock).toHaveBeenCalledTimes(1);
      expect(findByIdMock).toHaveBeenCalledWith('category-123', 'owner-123');

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the category version is stale', async () => {
      const updateCategoryDto = {
        name: 'Updated Development',
      } as UpdateCategoryDto;

      const command = new UpdateCategoryCommand(
        'category-123',
        updateCategoryDto,
        'owner-123',
        2,
      );

      findByIdMock.mockResolvedValue({
        _id: 'category-123',
        owner: 'owner-123',
        __v: 3,
      } as any);

      const promise = handler.execute(command);

      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(
        'Category has been modified. Please refresh and try again.',
      );

      expect(findByIdMock).toHaveBeenCalledTimes(1);

      expect(findByIdMock).toHaveBeenCalledWith('category-123', 'owner-123');

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when update returns null', async () => {
      const updateCategoryDto = {
        name: 'Updated Development',
      } as UpdateCategoryDto;

      const command = new UpdateCategoryCommand(
        'category-456',
        updateCategoryDto,
        'owner-456',
        5,
      );

      findByIdMock.mockResolvedValue({
        _id: 'category-456',
        owner: 'owner-456',
        __v: 5,
      } as any);

      updateMock.mockResolvedValue(null);

      const promise = handler.execute(command);

      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(
        'Category has been modified. Please refresh and try again.',
      );

      expect(findByIdMock).toHaveBeenCalledWith('category-456', 'owner-456');

      expect(updateMock).toHaveBeenCalledTimes(1);

      expect(updateMock).toHaveBeenCalledWith(
        'category-456',
        'owner-456',
        updateCategoryDto,
        5,
      );
    });

    it('should allow version 0 when expectedVersion is 0', async () => {
      const updateCategoryDto = {
        name: 'Initial Update',
      } as UpdateCategoryDto;

      const command = new UpdateCategoryCommand(
        'category-789',
        updateCategoryDto,
        'owner-789',
        0,
      );

      const category = {
        _id: 'category-789',
        owner: 'owner-789',
        __v: 0,
      };

      const updatedCategory = {
        ...category,
        name: 'Initial Update',
        __v: 1,
      };

      findByIdMock.mockResolvedValue(category as any);
      updateMock.mockResolvedValue(updatedCategory as any);

      const result = await handler.execute(command);

      expect(updateMock).toHaveBeenCalledWith(
        'category-789',
        'owner-789',
        updateCategoryDto,
        0,
      );

      expect(result).toBe(updatedCategory);
    });

    it('should propagate errors from findById', async () => {
      const updateCategoryDto = {
        name: 'Updated Development',
      } as UpdateCategoryDto;

      const command = new UpdateCategoryCommand(
        'category-123',
        updateCategoryDto,
        'owner-123',
        1,
      );

      findByIdMock.mockRejectedValue(new Error('Database lookup failed'));

      const promise = handler.execute(command);

      await expect(promise).rejects.toThrow('Database lookup failed');

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('should propagate errors from update', async () => {
      const updateCategoryDto = {
        name: 'Updated Development',
      } as UpdateCategoryDto;

      const command = new UpdateCategoryCommand(
        'category-123',
        updateCategoryDto,
        'owner-123',
        1,
      );

      findByIdMock.mockResolvedValue({
        _id: 'category-123',
        owner: 'owner-123',
        __v: 1,
      } as any);

      updateMock.mockRejectedValue(new Error('Database update failed'));

      const promise = handler.execute(command);

      await expect(promise).rejects.toThrow('Database update failed');

      expect(updateMock).toHaveBeenCalledTimes(1);
    });
  });
});
