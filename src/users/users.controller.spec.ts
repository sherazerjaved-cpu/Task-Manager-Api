import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { UsersController } from './users.controller';
import { GetUsersQuery } from './application/queries/get-users/get-users.query';
import { DeleteUserCommand } from './application/commands/delete-user/delete-user.command';

describe('UsersController', () => {
  let controller: UsersController;

  let queryBus: {
    execute: jest.Mock;
  };

  let commandBus: {
    execute: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: QueryBus,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);

    queryBus = module.get(QueryBus) as unknown as {
      execute: jest.Mock;
    };

    commandBus = module.get(CommandBus) as unknown as {
      execute: jest.Mock;
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should execute GetUsersQuery and return the result', async () => {
      const users = [
        {
          _id: 'user-1',
          email: 'one@example.com',
        },
        {
          _id: 'user-2',
          email: 'two@example.com',
        },
      ];

      queryBus.execute.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(queryBus.execute).toHaveBeenCalledTimes(1);

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetUsersQuery);

      expect(result).toBe(users);
    });

    it('should propagate QueryBus errors', async () => {
      const error = new Error('Failed to retrieve users');

      queryBus.execute.mockRejectedValue(error);

      await expect(controller.findAll()).rejects.toThrow(error);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteUser', () => {
    it('should execute DeleteUserCommand with the user ID', async () => {
      const userId = '507f1f77bcf86cd799439011';

      const expectedResult = {
        message: 'User Deleted Successfully',
      };

      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.deleteUser(userId);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      const command = commandBus.execute.mock.calls[0][0] as DeleteUserCommand;

      expect(command).toBeInstanceOf(DeleteUserCommand);
      expect(command.userId).toBe(userId);

      expect(result).toBe(expectedResult);
    });

    it('should propagate CommandBus errors', async () => {
      const userId = '507f1f77bcf86cd799439011';

      const error = new Error('Failed to delete user');

      commandBus.execute.mockRejectedValue(error);

      await expect(controller.deleteUser(userId)).rejects.toThrow(error);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });
  });
});
