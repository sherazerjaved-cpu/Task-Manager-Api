import { CreateCategoryHandler } from './create-category.handler';
import { CreateCategoryCommand } from './create-category.command';
import type { ICategoryRepository } from '../../../domain/repositories/category.repository.interface';
import type { CreateCategryDto } from '../../../DTO/create_category.dto';

describe('CreateCategoryHandler', () => {
  let handler: CreateCategoryHandler;
  let categoryRepository: jest.Mocked<ICategoryRepository>;
  let createMock: jest.Mock;

  beforeEach(() => {
    createMock = jest.fn();

    categoryRepository = {
      create: createMock,
    } as unknown as jest.Mocked<ICategoryRepository>;

    handler = new CreateCategoryHandler(categoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should create a category with the DTO data and owner ID', async () => {
      const createCategoryDto = {
        name: 'Development',
        description: 'Development related tasks',
      } as CreateCategryDto;

      const ownerId = 'owner-123';

      const command = new CreateCategoryCommand(createCategoryDto, ownerId);

      const createdCategory = {
        _id: 'category-123',
        name: 'Development',
        description: 'Development related tasks',
        owner: ownerId,
      };

      createMock.mockResolvedValue(createdCategory);

      const result = await handler.execute(command);

      expect(createMock).toHaveBeenCalledTimes(1);

      expect(createMock).toHaveBeenCalledWith({
        ...createCategoryDto,
        owner: ownerId,
      });

      expect(result).toBe(createdCategory);
    });

    it('should use the ownerId from the command as the category owner', async () => {
      const createCategoryDto = {
        name: 'Marketing',
        description: 'Marketing tasks',
      } as CreateCategryDto;

      const command = new CreateCategoryCommand(createCategoryDto, 'owner-456');

      createMock.mockResolvedValue({
        _id: 'category-456',
      });

      await handler.execute(command);

      expect(createMock).toHaveBeenCalledWith({
        name: 'Marketing',
        description: 'Marketing tasks',
        owner: 'owner-456',
      });
    });

    it('should preserve all DTO properties when creating the category', async () => {
      const createCategoryDto = {
        name: 'Bug',
        description: 'Bug tracking',
        color: 'red',
      } as CreateCategryDto;

      const command = new CreateCategoryCommand(createCategoryDto, 'owner-789');

      createMock.mockResolvedValue({
        _id: 'category-789',
      });

      await handler.execute(command);

      expect(createMock).toHaveBeenCalledWith({
        name: 'Bug',
        description: 'Bug tracking',
        color: 'red',
        owner: 'owner-789',
      });
    });

    it('should propagate repository errors', async () => {
      const createCategoryDto = {
        name: 'Development',
        description: 'Development tasks',
      } as CreateCategryDto;

      const command = new CreateCategoryCommand(createCategoryDto, 'owner-123');

      createMock.mockRejectedValue(new Error('Failed to create category'));

      await expect(handler.execute(command)).rejects.toThrow(
        'Failed to create category',
      );

      expect(createMock).toHaveBeenCalledTimes(1);
    });
  });
});
