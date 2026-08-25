import { AuthRepository } from './auth.repository';

describe('AuthRepository', () => {
  let repository: AuthRepository;

  const userModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    repository = new AuthRepository(userModel as any);
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const user = {
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
      };

      userModel.findOne.mockResolvedValue(user);

      const result = await repository.findByEmail('test@example.com');

      expect(userModel.findOne).toHaveBeenCalledTimes(1);
      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
      expect(result).toEqual(user);
    });

    it('should return null when the user does not exist', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await repository.findByEmail('missing@example.com');

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'missing@example.com',
      });
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create a user with email and password', async () => {
      const createdUser = {
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
      };

      userModel.create.mockResolvedValue(createdUser);

      const result = await repository.createUser(
        'test@example.com',
        'hashed-password',
      );

      expect(userModel.create).toHaveBeenCalledTimes(1);
      expect(userModel.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'hashed-password',
      });
      expect(result).toEqual(createdUser);
    });
  });

  describe('findById', () => {
    it('should find a user by id', async () => {
      const user = {
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
      };

      userModel.findById.mockResolvedValue(user);

      const result = await repository.findById('user-id');

      expect(userModel.findById).toHaveBeenCalledTimes(1);
      expect(userModel.findById).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(user);
    });

    it('should return null when the user does not exist', async () => {
      userModel.findById.mockResolvedValue(null);

      const result = await repository.findById('missing-id');

      expect(userModel.findById).toHaveBeenCalledWith('missing-id');
      expect(result).toBeNull();
    });
  });
});
