import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  let jwtService: {
    signAsync: jest.Mock;
  };

  let configService: {
    getOrThrow: jest.Mock;
  };

  beforeEach(async () => {
    jwtService = {
      signAsync: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_ACCESS_SECRET: 'access-secret',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };

        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate an access token with the correct payload and configuration', async () => {
      jwtService.signAsync.mockResolvedValue('access-token');

      const user = {
        _id: {
          toString: () => 'user-123',
        },
        email: 'user@example.com',
        role: 'user',
      };

      const result = await service.generateAccessToken(user);

      expect(result).toBe('access-token');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-123',
          email: 'user@example.com',
          role: 'user',
        },
        {
          secret: 'access-secret',
          expiresIn: '15m',
        },
      );
    });

    it('should read the access token secret and expiration from configuration', async () => {
      jwtService.signAsync.mockResolvedValue('access-token');

      const user = {
        _id: {
          toString: () => 'user-123',
        },
        email: 'user@example.com',
        role: 'admin',
      };

      await service.generateAccessToken(user);

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_ACCESS_SECRET',
      );

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_ACCESS_EXPIRES_IN',
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token with the correct payload and configuration', async () => {
      jwtService.signAsync.mockResolvedValue('refresh-token');

      const user = {
        _id: {
          toString: () => 'user-456',
        },
      };

      const result = await service.generateRefreshToken(
        user,
        'family-123',
        'token-456',
      );

      expect(result).toBe('refresh-token');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-456',
          family: 'family-123',
          jti: 'token-456',
        },
        {
          secret: 'refresh-secret',
          expiresIn: '7d',
        },
      );
    });

    it('should read the refresh token secret and expiration from configuration', async () => {
      jwtService.signAsync.mockResolvedValue('refresh-token');

      const user = {
        _id: {
          toString: () => 'user-456',
        },
      };

      await service.generateRefreshToken(user, 'family-123', 'token-456');

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_REFRESH_SECRET',
      );

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_REFRESH_EXPIRES_IN',
      );
    });
  });
});
