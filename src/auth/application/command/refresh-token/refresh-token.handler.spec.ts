import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

import { RefreshTokenHandler } from './refresh-token.handler';
import { RefreshTokenCommand } from './refresh-token.command';

import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';

import { TokenService } from 'src/auth/services/token.service';
import { AuditService } from 'src/audit/application/audit.service';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('RefreshTokenHandler', () => {
  let handler: RefreshTokenHandler;

  let userRepository: {
    findByIdWithRefreshToken: jest.Mock;
    clearRefreshToken: jest.Mock;
    updateRefreshToken: jest.Mock;
  };

  let tokenService: {
    generateAccessToken: jest.Mock;
    generateRefreshToken: jest.Mock;
  };

  let jwtService: {
    verify: jest.Mock;
  };

  let configService: {
    getOrThrow: jest.Mock;
  };

  let auditService: {
    log: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findByIdWithRefreshToken: jest.fn(),
      clearRefreshToken: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    tokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
    };

    jwtService = {
      verify: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn(),
    };

    auditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenHandler,
        {
          provide: USER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: TokenService,
          useValue: tokenService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    handler = module.get<RefreshTokenHandler>(RefreshTokenHandler);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('successful refresh', () => {
    it('should rotate the refresh token and return new tokens', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
        email: 'john@example.com',
        refreshTokenHash: 'stored-refresh-hash',
        tokenFamily: 'family-123',
        currentTokenId: 'token-123',
      };

      const payload = {
        sub: 'user-123',
        family: 'family-123',
        jti: 'token-123',
      };

      configService.getOrThrow.mockReturnValue('refresh-secret');

      jwtService.verify.mockReturnValue(payload);

      userRepository.findByIdWithRefreshToken.mockResolvedValue(user);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      tokenService.generateAccessToken.mockResolvedValue('new-access-token');

      tokenService.generateRefreshToken.mockResolvedValue('new-refresh-token');

      (bcrypt.hash as jest.Mock).mockResolvedValue('new-refresh-hash');

      const command = new RefreshTokenCommand({
        refresh_token: 'old-refresh-token',
      });

      const result = await handler.execute(command);

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_REFRESH_SECRET',
      );

      expect(jwtService.verify).toHaveBeenCalledWith('old-refresh-token', {
        secret: 'refresh-secret',
      });

      expect(userRepository.findByIdWithRefreshToken).toHaveBeenCalledWith(
        'user-123',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'old-refresh-token',
        'stored-refresh-hash',
      );

      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(user);

      expect(tokenService.generateRefreshToken).toHaveBeenCalledWith(
        user,
        'family-123',
        expect.any(String),
      );

      expect(userRepository.updateRefreshToken).toHaveBeenCalledWith(
        'user-123',
        'new-refresh-hash',
        'family-123',
        expect.any(String),
      );

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'REFRESH_TOKEN_SUCCESS',
        resource: 'AUTH',
      });
    });
  });

  describe('invalid token', () => {
    it('should reject an invalid refresh token', async () => {
      configService.getOrThrow.mockReturnValue('refresh-secret');

      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const command = new RefreshTokenCommand({
        refresh_token: 'invalid-refresh-token',
      });

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(userRepository.findByIdWithRefreshToken).not.toHaveBeenCalled();

      expect(auditService.log).toHaveBeenCalledWith({
        action: 'REFRESH_TOKEN_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'invalid_token',
        },
      });
    });
  });

  describe('refresh token not found', () => {
    it('should reject when the user or stored refresh token does not exist', async () => {
      configService.getOrThrow.mockReturnValue('refresh-secret');

      jwtService.verify.mockReturnValue({
        sub: 'user-123',
        family: 'family-123',
        jti: 'token-123',
      });

      userRepository.findByIdWithRefreshToken.mockResolvedValue(null);

      const command = new RefreshTokenCommand({
        refresh_token: 'refresh-token',
      });

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(auditService.log).toHaveBeenCalledWith({
        action: 'REFRESH_TOKEN_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'refresh_token_not_found',
        },
      });

      expect(userRepository.clearRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('token family reuse detection', () => {
    it('should clear the stored refresh token when the token family does not match', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
        refreshTokenHash: 'stored-hash',
        tokenFamily: 'correct-family',
        currentTokenId: 'token-123',
      };

      configService.getOrThrow.mockReturnValue('refresh-secret');

      jwtService.verify.mockReturnValue({
        sub: 'user-123',
        family: 'wrong-family',
        jti: 'token-123',
      });

      userRepository.findByIdWithRefreshToken.mockResolvedValue(user);

      const command = new RefreshTokenCommand({
        refresh_token: 'refresh-token',
      });

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(userRepository.clearRefreshToken).toHaveBeenCalledWith('user-123');

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        resource: 'AUTH',
        meta: {
          reason: 'token_family_mismatch',
        },
      });

      expect(tokenService.generateAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('token ID reuse detection', () => {
    it('should clear the stored refresh token when the token ID does not match', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
        refreshTokenHash: 'stored-hash',
        tokenFamily: 'family-123',
        currentTokenId: 'correct-token-id',
      };

      configService.getOrThrow.mockReturnValue('refresh-secret');

      jwtService.verify.mockReturnValue({
        sub: 'user-123',
        family: 'family-123',
        jti: 'wrong-token-id',
      });

      userRepository.findByIdWithRefreshToken.mockResolvedValue(user);

      const command = new RefreshTokenCommand({
        refresh_token: 'refresh-token',
      });

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(userRepository.clearRefreshToken).toHaveBeenCalledWith('user-123');

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        resource: 'AUTH',
        meta: {
          reason: 'token_id_mismatch',
        },
      });

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('token hash reuse detection', () => {
    it('should clear the stored refresh token when the hash does not match', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
        refreshTokenHash: 'stored-hash',
        tokenFamily: 'family-123',
        currentTokenId: 'token-123',
      };

      configService.getOrThrow.mockReturnValue('refresh-secret');

      jwtService.verify.mockReturnValue({
        sub: 'user-123',
        family: 'family-123',
        jti: 'token-123',
      });

      userRepository.findByIdWithRefreshToken.mockResolvedValue(user);

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const command = new RefreshTokenCommand({
        refresh_token: 'refresh-token',
      });

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(userRepository.clearRefreshToken).toHaveBeenCalledWith('user-123');

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        resource: 'AUTH',
        meta: {
          reason: 'token_hash_mismatch',
        },
      });

      expect(tokenService.generateAccessToken).not.toHaveBeenCalled();
    });
  });
});
