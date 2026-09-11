import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;

  let userModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
  };

  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  const userId = '507f1f77bcf86cd799439011';
  const email = 'test@example.com';

  const user = {
    _id: userId,
    email,
    password: 'hashed-password',
    emailVerified: false,
  };

  beforeEach(() => {
    userModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    repository = new UserRepository(userModel as any, cacheManager as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('should return cached users when cache exists', async () => {
      const cachedUsers = [user];

      cacheManager.get.mockResolvedValue(cachedUsers);

      const result = await repository.findAll();

      expect(cacheManager.get).toHaveBeenCalledWith('users:all');

      expect(userModel.find).not.toHaveBeenCalled();

      expect(result).toBe(cachedUsers);
    });

    it('should fetch users from database when cache is empty', async () => {
      const users = [user];

      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue(users);

      userModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      const result = await repository.findAll();

      expect(userModel.find).toHaveBeenCalledTimes(1);

      expect(userModel.find().select).toHaveBeenCalledWith('-password');

      expect(cacheManager.set).toHaveBeenCalledWith(
        'users:all',
        users,
        60 * 1000,
      );

      expect(result).toBe(users);
    });
  });

  // ---------------------------------------------------------------------------
  // findByEmail
  // ---------------------------------------------------------------------------

  describe('findByEmail', () => {
    it('should find a user by email and include password', async () => {
      const execResult = user;

      const select = jest.fn().mockResolvedValue(execResult);

      userModel.findOne.mockReturnValue({
        select,
      });

      const result = await repository.findByEmail(email);

      expect(userModel.findOne).toHaveBeenCalledWith({
        email,
      });

      expect(select).toHaveBeenCalledWith('+password');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // findByEmailWithPassword
  // ---------------------------------------------------------------------------

  describe('findByEmailWithPassword', () => {
    it('should find a user by email with password selected', async () => {
      const exec = jest.fn().mockResolvedValue(user);

      const select = jest.fn().mockReturnValue({
        exec,
      });

      userModel.findOne.mockReturnValue({
        select,
      });

      const result = await repository.findByEmailWithPassword(email);

      expect(userModel.findOne).toHaveBeenCalledWith({
        email,
      });

      expect(select).toHaveBeenCalledWith('+password');
      expect(exec).toHaveBeenCalled();

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('should return cached user when cache exists', async () => {
      cacheManager.get.mockResolvedValue(user);

      const result = await repository.findById(userId);

      expect(cacheManager.get).toHaveBeenCalledWith(`user:${userId}`);

      expect(userModel.findById).not.toHaveBeenCalled();

      expect(result).toBe(user);
    });

    it('should fetch user from database when cache is empty', async () => {
      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue(user);

      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      const result = await repository.findById(userId);

      expect(userModel.findById).toHaveBeenCalledWith(userId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `user:${userId}`,
        user,
        60 * 1000,
      );

      expect(result).toBe(user);
    });

    it('should not cache when user does not exist', async () => {
      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue(null);

      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      const result = await repository.findById(userId);

      expect(result).toBeNull();

      expect(cacheManager.set).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // createUser
  // ---------------------------------------------------------------------------

  describe('createUser', () => {
    it('should create a user, fetch it without password, and invalidate users cache', async () => {
      const createdUser = {
        _id: userId,
        email,
      };

      userModel.create.mockResolvedValue({
        _id: userId,
      });

      const exec = jest.fn().mockResolvedValue(createdUser);

      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      const expiresAt = new Date();

      const result = await repository.createUser(
        email,
        'hashed-password',
        'verification-hash',
        expiresAt,
      );

      expect(userModel.create).toHaveBeenCalledWith({
        email,
        password: 'hashed-password',
        emailVerified: false,
        emailVerificationTokenHash: 'verification-hash',
        emailVerificationExpiresAt: expiresAt,
      });

      expect(userModel.findById).toHaveBeenCalledWith(userId);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(createdUser);
    });

    it('should throw when created user cannot be fetched', async () => {
      userModel.create.mockResolvedValue({
        _id: userId,
      });

      const exec = jest.fn().mockResolvedValue(null);

      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      await expect(
        repository.createUser(
          email,
          'hashed-password',
          'verification-hash',
          new Date(),
        ),
      ).rejects.toThrow('User creation failed');

      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findByIdWithRefreshToken
  // ---------------------------------------------------------------------------

  describe('findByIdWithRefreshToken', () => {
    it('should find user and select refresh-token fields', async () => {
      const select = jest.fn().mockResolvedValue(user);

      userModel.findById.mockReturnValue({
        select,
      });

      const result = await repository.findByIdWithRefreshToken(userId);

      expect(userModel.findById).toHaveBeenCalledWith(userId);

      expect(select).toHaveBeenCalledWith('+refreshTokenHash +currentTokenId');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // clearRefreshToken
  // ---------------------------------------------------------------------------

  describe('clearRefreshToken', () => {
    it('should clear refresh-token fields and invalidate cache', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue(user);

      const result = await repository.clearRefreshToken(userId);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          refreshTokenHash: null,
          tokenFamily: null,
          currentTokenId: null,
        },
        {
          new: true,
        },
      );

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteUser
  // ---------------------------------------------------------------------------

  describe('deleteUser', () => {
    it('should delete user and invalidate both user caches', async () => {
      userModel.findOneAndDelete.mockResolvedValue(user);

      const result = await repository.deleteUser(userId);

      expect(userModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: userId,
      });

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });

    it('should invalidate caches even when user does not exist', async () => {
      userModel.findOneAndDelete.mockResolvedValue(null);

      const result = await repository.deleteUser(userId);

      expect(result).toBeNull();

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');
    });
  });

  // ---------------------------------------------------------------------------
  // updateRefreshToken
  // ---------------------------------------------------------------------------

  describe('updateRefreshToken', () => {
    it('should update refresh token information and invalidate cache', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue(user);

      const result = await repository.updateRefreshToken(
        userId,
        'new-refresh-hash',
        'family-1',
        'token-1',
      );

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          refreshTokenHash: 'new-refresh-hash',
          tokenFamily: 'family-1',
          currentTokenId: 'token-1',
        },
        {
          new: true,
        },
      );

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // setEmailVerificationToken
  // ---------------------------------------------------------------------------

  describe('setEmailVerificationToken', () => {
    it('should set email verification token and invalidate cache', async () => {
      const expiresAt = new Date();

      const exec = jest.fn().mockResolvedValue(user);

      userModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.setEmailVerificationToken(
        userId,
        'token-hash',
        expiresAt,
      );

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          emailVerificationTokenHash: 'token-hash',
          emailVerificationExpiresAt: expiresAt,
          emailVerified: false,
        },
        {
          new: true,
        },
      );

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // verifyEmail
  // ---------------------------------------------------------------------------

  describe('verifyEmail', () => {
    it('should verify email using a valid non-expired token', async () => {
      const exec = jest.fn().mockResolvedValue(user);

      userModel.findOneAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.verifyEmail('verification-hash');

      const [filter, update, options] =
        userModel.findOneAndUpdate.mock.calls[0];

      expect(filter.emailVerificationTokenHash).toBe('verification-hash');

      expect(filter.emailVerificationExpiresAt).toEqual({
        $gt: expect.any(Date),
      });

      expect(filter.emailVerified).toBe(false);

      expect(update).toEqual({
        $set: {
          emailVerified: true,
        },
        $unset: {
          emailVerificationTokenHash: 1,
          emailVerificationExpiresAt: 1,
        },
      });

      expect(options).toEqual({
        new: true,
      });

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });

    it('should not invalidate cache when verification fails', async () => {
      const exec = jest.fn().mockResolvedValue(null);

      userModel.findOneAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.verifyEmail('invalid-token');

      expect(result).toBeNull();

      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // clearEmailVerificationToken
  // ---------------------------------------------------------------------------

  describe('clearEmailVerificationToken', () => {
    it('should clear email verification fields and invalidate cache', async () => {
      const exec = jest.fn().mockResolvedValue(user);

      userModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.clearEmailVerificationToken(userId);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          $unset: {
            emailVerificationTokenHash: 1,
            emailVerificationExpiresAt: 1,
          },
        },
        {
          new: true,
        },
      );

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // findByEmailWithoutPassword
  // ---------------------------------------------------------------------------

  describe('findByEmailWithoutPassword', () => {
    it('should lowercase the email before querying', async () => {
      userModel.findOne.mockResolvedValue(user);

      const result =
        await repository.findByEmailWithoutPassword('TEST@EXAMPLE.COM');

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
      });

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // setPasswordResetToken
  // ---------------------------------------------------------------------------

  describe('setPasswordResetToken', () => {
    it('should set password reset token and invalidate cache', async () => {
      const expiresAt = new Date();

      const exec = jest.fn().mockResolvedValue(user);

      userModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.setPasswordResetToken(
        userId,
        'reset-hash',
        expiresAt,
      );

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          passwordResetTokenHash: 'reset-hash',
          passwordResetExpiresAt: expiresAt,
        },
        {
          new: true,
        },
      );

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // findByPasswordResetToken
  // ---------------------------------------------------------------------------

  describe('findByPasswordResetToken', () => {
    it('should find a non-expired password reset token with password selected', async () => {
      const exec = jest.fn().mockResolvedValue(user);

      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      const result = await repository.findByPasswordResetToken('reset-hash');

      const filter = userModel.findOne.mock.calls[0][0];

      expect(filter).toEqual({
        passwordResetTokenHash: 'reset-hash',
        passwordResetExpiresAt: {
          $gt: expect.any(Date),
        },
      });

      expect(userModel.findOne().select).toHaveBeenCalledWith('+password');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // clearPasswordResetToken
  // ---------------------------------------------------------------------------

  describe('clearPasswordResetToken', () => {
    it('should clear password reset fields and invalidate cache', async () => {
      const exec = jest.fn().mockResolvedValue(user);

      userModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.clearPasswordResetToken(userId);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          $unset: {
            passwordResetTokenHash: 1,
            passwordResetExpiresAt: 1,
          },
        },
        {
          new: true,
        },
      );

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });
  });

  // ---------------------------------------------------------------------------
  // updatePassword
  // ---------------------------------------------------------------------------

  describe('updatePassword', () => {
    it('should update password, exclude password from result, and invalidate cache', async () => {
      const exec = jest.fn().mockResolvedValue(user);

      userModel.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec,
        }),
      });

      const result = await repository.updatePassword(
        userId,
        'new-password-hash',
      );

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          password: 'new-password-hash',
        },
        {
          new: true,
        },
      );

      expect(userModel.findByIdAndUpdate().select).toHaveBeenCalledWith(
        '-password',
      );

      expect(cacheManager.del).toHaveBeenCalledWith(`user:${userId}`);

      expect(cacheManager.del).toHaveBeenCalledWith('users:all');

      expect(result).toBe(user);
    });
  });
});
