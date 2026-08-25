import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

import { LoginHandler } from './login.handler';
import { LoginCommand } from './login.command';

import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { TokenService } from 'src/auth/services/token.service';
import { BruteForceService } from 'src/auth/services/brute-force.service';
import { AuditService } from 'src/audit/application/audit.service';

describe('LoginHandler', () => {
  let handler: LoginHandler;

  let userRepository: {
    findByEmail: jest.Mock;
    updateRefreshToken: jest.Mock;
  };

  let tokenService: {
    generateAccessToken: jest.Mock;
    generateRefreshToken: jest.Mock;
  };

  let bruteForceService: {
    isBlocked: jest.Mock;
    recordFailure: jest.Mock;
    reset: jest.Mock;
  };

  let auditService: {
    log: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    tokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
    };

    bruteForceService = {
      isBlocked: jest.fn(),
      recordFailure: jest.fn(),
      reset: jest.fn(),
    };

    auditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHandler,
        {
          provide: USER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: TokenService,
          useValue: tokenService,
        },
        {
          provide: BruteForceService,
          useValue: bruteForceService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    handler = module.get<LoginHandler>(LoginHandler);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('successful login', () => {
    it('should authenticate the user and return access and refresh tokens', async () => {
      const user = {
        _id: 'user-123',
        email: 'john@example.com',
        password: 'hashed-password',
        emailVerified: true,
      };

      userRepository.findByEmail.mockResolvedValue(user);
      bruteForceService.isBlocked.mockResolvedValue(false);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');

      tokenService.generateAccessToken.mockResolvedValue('access-token');
      tokenService.generateRefreshToken.mockResolvedValue('refresh-token');

      const command = new LoginCommand(
        {
          email: 'john@example.com',
          password: 'Password123!',
        },
        '127.0.0.1',
      );

      const result = await handler.execute(command);

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        'john@example.com',
      );

      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(user);

      expect(tokenService.generateRefreshToken).toHaveBeenCalledWith(
        user,
        expect.any(String),
        expect.any(String),
      );

      expect(userRepository.updateRefreshToken).toHaveBeenCalledWith(
        'user-123',
        'hashed-refresh-token',
        expect.any(String),
        expect.any(String),
      );

      expect(bruteForceService.reset).toHaveBeenCalledWith('john@example.com');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-123',
          action: 'LOGIN_SUCCESS',
          resource: 'AUTH',
          ip: '127.0.0.1',
        }),
      );
    });
  });

  describe('invalid credentials', () => {
    it('should reject login when user does not exist', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      bruteForceService.isBlocked.mockResolvedValue(false);

      const command = new LoginCommand(
        {
          email: 'unknown@example.com',
          password: 'Password123!',
        },
        '127.0.0.1',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(bruteForceService.recordFailure).toHaveBeenCalledWith(
        'unknown@example.com',
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
          ip: '127.0.0.1',
        }),
      );
    });

    it('should reject login when password is incorrect', async () => {
      const user = {
        _id: 'user-123',
        email: 'john@example.com',
        password: 'hashed-password',
        emailVerified: true,
      };

      userRepository.findByEmail.mockResolvedValue(user);
      bruteForceService.isBlocked.mockResolvedValue(false);

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const command = new LoginCommand(
        {
          email: 'john@example.com',
          password: 'WrongPassword!',
        },
        '127.0.0.1',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(bruteForceService.recordFailure).toHaveBeenCalledWith(
        'john@example.com',
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-123',
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
        }),
      );
    });
  });

  describe('account protection', () => {
    it('should reject login when brute-force protection blocks the user', async () => {
      bruteForceService.isBlocked.mockResolvedValue(true);

      const command = new LoginCommand(
        {
          email: 'john@example.com',
          password: 'Password123!',
        },
        '127.0.0.1',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(bruteForceService.recordFailure).not.toHaveBeenCalled();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_BLOCKED',
          resource: 'AUTH',
          ip: '127.0.0.1',
        }),
      );
    });

    it('should reject login when email is not verified', async () => {
      const user = {
        _id: 'user-123',
        email: 'john@example.com',
        password: 'hashed-password',
        emailVerified: false,
      };

      userRepository.findByEmail.mockResolvedValue(user);
      bruteForceService.isBlocked.mockResolvedValue(false);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const command = new LoginCommand(
        {
          email: 'john@example.com',
          password: 'Password123!',
        },
        '127.0.0.1',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        ForbiddenException,
      );

      expect(bruteForceService.reset).not.toHaveBeenCalled();

      expect(tokenService.generateAccessToken).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-123',
          action: 'LOGIN_BLOCKED',
          resource: 'AUTH',
        }),
      );
    });
  });
});
