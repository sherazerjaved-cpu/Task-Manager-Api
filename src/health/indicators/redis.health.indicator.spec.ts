import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';
import { RedisHealthIndicator } from './redis.health.indicator';

jest.mock('ioredis');

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let configService: {
    getOrThrow: jest.Mock;
  };

  let redis: {
    status: string;
    connect: jest.Mock;
    ping: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(() => {
    redis = {
      status: 'wait',
      connect: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
    };

    (Redis as unknown as jest.Mock).mockImplementation(() => redis);

    configService = {
      getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    indicator = new RedisHealthIndicator(
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should read REDIS_URL from ConfigService', () => {
      expect(configService.getOrThrow).toHaveBeenCalledTimes(1);

      expect(configService.getOrThrow).toHaveBeenCalledWith('REDIS_URL');
    });

    it('should create a Redis client with lazy connection enabled', () => {
      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    });
  });

  describe('isHealthy', () => {
    it('should connect when Redis status is wait', async () => {
      redis.status = 'wait';
      redis.connect.mockResolvedValue(undefined);
      redis.ping.mockResolvedValue('PONG');

      const result = await indicator.isHealthy('redis');

      expect(redis.connect).toHaveBeenCalledTimes(1);
      expect(redis.ping).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        redis: {
          status: 'up',
        },
      });
    });

    it('should not call connect when Redis is already connected', async () => {
      redis.status = 'ready';
      redis.ping.mockResolvedValue('PONG');

      const result = await indicator.isHealthy('redis');

      expect(redis.connect).not.toHaveBeenCalled();
      expect(redis.ping).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        redis: {
          status: 'up',
        },
      });
    });

    it('should return healthy when Redis responds with PONG', async () => {
      redis.status = 'ready';
      redis.ping.mockResolvedValue('PONG');

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'up',
        },
      });
    });

    it('should call ping exactly once', async () => {
      redis.status = 'ready';
      redis.ping.mockResolvedValue('PONG');

      await indicator.isHealthy('redis');

      expect(redis.ping).toHaveBeenCalledTimes(1);
    });

    it('should reject when Redis returns an unexpected response', async () => {
      redis.status = 'ready';
      redis.ping.mockResolvedValue('OK');

      await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
        HealthCheckError,
      );

      expect(redis.ping).toHaveBeenCalledTimes(1);
    });

    it('should include the unexpected Redis response in the error', async () => {
      redis.status = 'ready';
      redis.ping.mockResolvedValue('INVALID');

      try {
        await indicator.isHealthy('redis');
        fail('Expected isHealthy to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);

        expect((error as HealthCheckError).causes).toEqual({
          redis: {
            status: 'down',
            message: 'Unexpected Redis response: INVALID',
          },
        });
      }
    });

    it('should reject when Redis ping fails', async () => {
      redis.status = 'ready';

      const error = new Error('Redis connection refused');

      redis.ping.mockRejectedValue(error);

      await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
        HealthCheckError,
      );
    });

    it('should preserve the Redis error message', async () => {
      redis.status = 'ready';

      redis.ping.mockRejectedValue(new Error('Connection refused'));

      try {
        await indicator.isHealthy('redis');
        fail('Expected isHealthy to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);

        expect((error as HealthCheckError).causes).toEqual({
          redis: {
            status: 'down',
            message: 'Connection refused',
          },
        });
      }
    });

    it('should handle non-Error Redis failures', async () => {
      redis.status = 'ready';

      redis.ping.mockRejectedValue('Redis unavailable');

      try {
        await indicator.isHealthy('redis');
        fail('Expected isHealthy to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);

        expect((error as HealthCheckError).causes).toEqual({
          redis: {
            status: 'down',
            message: 'Redis unavailable',
          },
        });
      }
    });

    it('should not call ping when connect fails', async () => {
      redis.status = 'wait';

      redis.connect.mockRejectedValue(new Error('Unable to connect to Redis'));

      await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
        HealthCheckError,
      );

      expect(redis.connect).toHaveBeenCalledTimes(1);
      expect(redis.ping).not.toHaveBeenCalled();
    });

    it('should use the supplied health indicator key', async () => {
      redis.status = 'ready';
      redis.ping.mockResolvedValue('PONG');

      const result = await indicator.isHealthy('cache');

      expect(result).toEqual({
        cache: {
          status: 'up',
        },
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit Redis when the connection has not ended', async () => {
      redis.status = 'ready';
      redis.quit.mockResolvedValue('OK');

      await indicator.onModuleDestroy();

      expect(redis.quit).toHaveBeenCalledTimes(1);
    });

    it('should quit Redis when status is wait', async () => {
      redis.status = 'wait';
      redis.quit.mockResolvedValue('OK');

      await indicator.onModuleDestroy();

      expect(redis.quit).toHaveBeenCalledTimes(1);
    });

    it('should not quit Redis when the connection has already ended', async () => {
      redis.status = 'end';

      await indicator.onModuleDestroy();

      expect(redis.quit).not.toHaveBeenCalled();
    });

    it('should propagate quit errors', async () => {
      redis.status = 'ready';

      const error = new Error('Redis quit failed');

      redis.quit.mockRejectedValue(error);

      await expect(indicator.onModuleDestroy()).rejects.toBe(error);
    });
  });
});
