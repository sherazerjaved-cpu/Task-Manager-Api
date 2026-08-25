import { GetUsersHandler } from './get-users.handler';

describe('GetUsersHandler', () => {
  let handler: GetUsersHandler;

  let userRepository: {
    findAll: jest.Mock;
  };

  beforeEach(() => {
    userRepository = {
      findAll: jest.fn(),
    };

    handler = new GetUsersHandler(userRepository as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all users from the repository', async () => {
      const users = [
        {
          _id: 'user-1',
          email: 'user1@example.com',
        },
        {
          _id: 'user-2',
          email: 'user2@example.com',
        },
      ];

      userRepository.findAll.mockResolvedValue(users);

      const result = await handler.execute();

      expect(userRepository.findAll).toHaveBeenCalledTimes(1);
      expect(userRepository.findAll).toHaveBeenCalledWith();

      expect(result).toEqual(users);
    });

    it('should return an empty array when the repository returns no users', async () => {
      userRepository.findAll.mockResolvedValue([]);

      const result = await handler.execute();

      expect(userRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });
});
