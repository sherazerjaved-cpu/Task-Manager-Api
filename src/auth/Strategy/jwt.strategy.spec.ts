import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should be defined when JWT access secret is configured', () => {
      configService.get.mockReturnValue('test-access-secret');

      const strategy = new JwtStrategy(
        configService as unknown as ConfigService,
      );

      expect(strategy).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
    });

    it('should throw when JWT access secret is not configured', () => {
      configService.get.mockReturnValue(undefined);

      expect(
        () => new JwtStrategy(configService as unknown as ConfigService),
      ).toThrow('Jwt Secret is not defined');
    });

    it('should throw when JWT access secret is an empty string', () => {
      configService.get.mockReturnValue('');

      expect(
        () => new JwtStrategy(configService as unknown as ConfigService),
      ).toThrow('Jwt Secret is not defined');
    });
  });

  describe('validate', () => {
    let strategy: JwtStrategy;

    beforeEach(() => {
      configService.get.mockReturnValue('test-access-secret');

      strategy = new JwtStrategy(configService as unknown as ConfigService);
    });

    it('should transform the JWT payload into the authenticated user object', () => {
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'user',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'user',
      });
    });

    it('should use the sub claim as userId', () => {
      const payload = {
        sub: 'abc-123',
        email: 'test@example.com',
        role: 'admin',
      };

      const result = strategy.validate(payload);

      expect(result.userId).toBe('abc-123');
    });

    it('should preserve the email from the JWT payload', () => {
      const payload = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
      };

      const result = strategy.validate(payload);

      expect(result.email).toBe('admin@example.com');
    });

    it('should preserve the role from the JWT payload', () => {
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'member',
      };

      const result = strategy.validate(payload);

      expect(result.role).toBe('member');
    });

    it('should only return the expected authenticated user fields', () => {
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'user',
        password: 'should-not-be-returned',
        secret: 'should-not-be-returned',
        extraField: 'ignored',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'user',
      });

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('secret');
      expect(result).not.toHaveProperty('extraField');
    });
  });
});
