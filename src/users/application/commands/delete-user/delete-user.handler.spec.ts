import { NotFoundException } from '@nestjs/common';

import { DeleteUserHandler } from './delete-user.handler';
import { DeleteUserCommand } from './delete-user.command';

describe('DeleteUserHandler', () => {
  let handler: DeleteUserHandler;

  let userRepository: {
    deleteUser: jest.Mock;
  };

  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    userRepository = {
      deleteUser: jest.fn(),
    };

    handler = new DeleteUserHandler(userRepository as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should delete the user and return success message', async () => {
      const deletedUser = {
        _id: userId,
        email: 'test@example.com',
      };

      userRepository.deleteUser.mockResolvedValue(deletedUser);

      const command = new DeleteUserCommand(userId);

      const result = await handler.execute(command);

      expect(userRepository.deleteUser).toHaveBeenCalledTimes(1);
      expect(userRepository.deleteUser).toHaveBeenCalledWith(userId);

      expect(result).toEqual({
        message: 'User Deleted Successfully',
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.deleteUser.mockResolvedValue(null);

      const command = new DeleteUserCommand(userId);

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('User Not Found'),
      );

      expect(userRepository.deleteUser).toHaveBeenCalledTimes(1);
      expect(userRepository.deleteUser).toHaveBeenCalledWith(userId);
    });
  });
});
