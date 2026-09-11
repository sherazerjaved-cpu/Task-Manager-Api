import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CategoriesController } from './categories.controller';

import { CreateCategoryCommand } from './application/commands/create-category/create-category.command';
import { GetCategoriesQuery } from './application/queries/get-categories/get-categories.query';
import { GetCategoryQuery } from './application/queries/get-category/get-category.query';
import { UpdateCategoryCommand } from './application/commands/update-category/update-category.command';
import { DeleteCategoryCommand } from './application/commands/delete-category/delete-category.command';

import type { CreateCategryDto } from './DTO/create_category.dto';
import type { UpdateCategoryDto } from './DTO/update_category.dto';

describe('CategoriesController', () => {
  let controller: CategoriesController;

  let commandBus: {
    execute: jest.Mock;
  };

  let queryBus: {
    execute: jest.Mock;
  };

  beforeEach(() => {
    commandBus = {
      execute: jest.fn(),
    };

    queryBus = {
      execute: jest.fn(),
    };

    controller = new CategoriesController(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should execute CreateCategoryCommand with the DTO and authenticated user ID', async () => {
      const createCategoryDto = {
        name: 'Work',
        color: '#3498db',
      } as CreateCategryDto;

      const request = {
        user: {
          userId: 'user-123',
        },
      };

      const createdCategory = {
        _id: 'category-123',
        name: 'Work',
        color: '#3498db',
        owner: 'user-123',
      };

      commandBus.execute.mockResolvedValue(createdCategory);

      const result = await controller.create(createCategoryDto, request);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CreateCategoryCommand),
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(CreateCategoryCommand);
      expect(command.createCategoryDto).toBe(createCategoryDto);
      expect(command.ownerId).toBe('user-123');

      expect(result).toBe(createdCategory);
    });

    it('should propagate CommandBus errors', async () => {
      const createCategoryDto = {
        name: 'Work',
      } as CreateCategryDto;

      const request = {
        user: {
          userId: 'user-123',
        },
      };

      commandBus.execute.mockRejectedValue(
        new Error('Failed to create category'),
      );

      await expect(
        controller.create(createCategoryDto, request),
      ).rejects.toThrow('Failed to create category');

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should execute GetCategoriesQuery with the authenticated user ID', async () => {
      const request = {
        user: {
          userId: 'user-123',
        },
      };

      const categories = [
        {
          _id: 'category-1',
          name: 'Work',
          owner: 'user-123',
        },
        {
          _id: 'category-2',
          name: 'Personal',
          owner: 'user-123',
        },
      ];

      queryBus.execute.mockResolvedValue(categories);

      const result = await controller.findAll(request);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetCategoriesQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetCategoriesQuery);
      expect(query.ownerId).toBe('user-123');

      expect(result).toBe(categories);
    });

    it('should return an empty array when the query returns no categories', async () => {
      const request = {
        user: {
          userId: 'user-456',
        },
      };

      queryBus.execute.mockResolvedValue([]);

      const result = await controller.findAll(request);

      expect(result).toEqual([]);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetCategoriesQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query.ownerId).toBe('user-456');
    });

    it('should propagate QueryBus errors', async () => {
      const request = {
        user: {
          userId: 'user-123',
        },
      };

      queryBus.execute.mockRejectedValue(
        new Error('Failed to fetch categories'),
      );

      await expect(controller.findAll(request)).rejects.toThrow(
        'Failed to fetch categories',
      );
    });
  });

  describe('findOne', () => {
    it('should execute GetCategoryQuery with category ID and authenticated user ID', async () => {
      const categoryId = '507f1f77bcf86cd799439011';

      const request = {
        user: {
          userId: 'user-123',
        },
      };

      const category = {
        _id: categoryId,
        name: 'Work',
        owner: 'user-123',
      };

      queryBus.execute.mockResolvedValue(category);

      const result = await controller.findOne(categoryId, request);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetCategoryQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetCategoryQuery);
      expect(query.id).toBe(categoryId);
      expect(query.ownerId).toBe('user-123');

      expect(result).toBe(category);
    });

    it('should propagate QueryBus errors', async () => {
      const categoryId = '507f1f77bcf86cd799439011';

      const request = {
        user: {
          userId: 'user-123',
        },
      };

      queryBus.execute.mockRejectedValue(new Error('Category lookup failed'));

      await expect(controller.findOne(categoryId, request)).rejects.toThrow(
        'Category lookup failed',
      );
    });
  });

  describe('update', () => {
    it('should execute UpdateCategoryCommand with parsed If-Match version', async () => {
      const categoryId = '507f1f77bcf86cd799439011';

      const updateCategoryDto = {
        name: 'Updated Work',
        color: '#2ecc71',
      } as UpdateCategoryDto;

      const request = {
        user: {
          userId: 'user-123',
        },
        headers: {
          'if-match': '"2"',
        },
      };

      const response = {
        setHeader: jest.fn(),
      };

      const updatedCategory = {
        _id: categoryId,
        name: 'Updated Work',
        color: '#2ecc71',
        owner: 'user-123',
        __v: 3,
      };

      commandBus.execute.mockResolvedValue(updatedCategory);

      const result = await controller.update(
        categoryId,
        updateCategoryDto,
        request,
        response as any,
      );

      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(UpdateCategoryCommand),
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(UpdateCategoryCommand);
      expect(command.id).toBe(categoryId);
      expect(command.updateCategoryDto).toBe(updateCategoryDto);
      expect(command.ownerId).toBe('user-123');
      expect(command.expectedVersion).toBe(2);

      expect(response.setHeader).toHaveBeenCalledTimes(1);

      expect(response.setHeader).toHaveBeenCalledWith('ETag', '"3"');

      expect(result).toBe(updatedCategory);
    });

    it('should set the ETag using the updated category version', async () => {
      const categoryId = '507f1f77bcf86cd799439012';

      const updateCategoryDto = {
        name: 'Updated',
      } as UpdateCategoryDto;

      const request = {
        user: {
          userId: 'user-456',
        },
        headers: {
          'if-match': '"7"',
        },
      };

      const response = {
        setHeader: jest.fn(),
      };

      const updatedCategory = {
        _id: categoryId,
        name: 'Updated',
        owner: 'user-456',
        __v: 8,
      };

      commandBus.execute.mockResolvedValue(updatedCategory);

      await controller.update(
        categoryId,
        updateCategoryDto,
        request,
        response as any,
      );

      expect(response.setHeader).toHaveBeenCalledWith('ETag', '"8"');
    });

    it('should pass the authenticated user ID to UpdateCategoryCommand', async () => {
      const categoryId = '507f1f77bcf86cd799439013';

      const updateCategoryDto = {
        name: 'Updated',
      } as UpdateCategoryDto;

      const request = {
        user: {
          userId: 'user-789',
        },
        headers: {
          'if-match': '"4"',
        },
      };

      const response = {
        setHeader: jest.fn(),
      };

      const updatedCategory = {
        _id: categoryId,
        name: 'Updated',
        owner: 'user-789',
        __v: 5,
      };

      commandBus.execute.mockResolvedValue(updatedCategory);

      await controller.update(
        categoryId,
        updateCategoryDto,
        request,
        response as any,
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command.ownerId).toBe('user-789');
    });

    it('should propagate CommandBus errors', async () => {
      const categoryId = '507f1f77bcf86cd799439014';

      const updateCategoryDto = {
        name: 'Updated',
      } as UpdateCategoryDto;

      const request = {
        user: {
          userId: 'user-123',
        },
        headers: {
          'if-match': '"1"',
        },
      };

      const response = {
        setHeader: jest.fn(),
      };

      commandBus.execute.mockRejectedValue(new Error('Category update failed'));

      await expect(
        controller.update(
          categoryId,
          updateCategoryDto,
          request,
          response as any,
        ),
      ).rejects.toThrow('Category update failed');

      expect(response.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should execute DeleteCategoryCommand with category ID and authenticated user ID', async () => {
      const categoryId = '507f1f77bcf86cd799439015';

      const request = {
        user: {
          userId: 'user-123',
        },
      };

      const deletedResponse = {
        message: 'Category Deleted Successfully',
      };

      commandBus.execute.mockResolvedValue(deletedResponse);

      const result = await controller.remove(categoryId, request);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(DeleteCategoryCommand),
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(DeleteCategoryCommand);
      expect(command.id).toBe(categoryId);
      expect(command.ownerId).toBe('user-123');

      expect(result).toBe(deletedResponse);
    });

    it('should propagate CommandBus errors', async () => {
      const categoryId = '507f1f77bcf86cd799439016';

      const request = {
        user: {
          userId: 'user-123',
        },
      };

      commandBus.execute.mockRejectedValue(
        new Error('Category deletion failed'),
      );

      await expect(controller.remove(categoryId, request)).rejects.toThrow(
        'Category deletion failed',
      );
    });
  });
});
