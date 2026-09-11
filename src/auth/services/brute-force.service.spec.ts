jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
  }));

  return {
    __esModule: true,
    default: RedisMock,
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { BruteForceService } from './brute-force.service';

describe('BruteForceService', () => {
  let service: BruteForceService;

  let redis: {
    get: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
    del: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BruteForceService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<BruteForceService>(BruteForceService);

    redis = (Redis as unknown as jest.Mock).mock.results[
      (Redis as unknown as jest.Mock).mock.results.length - 1
    ].value;

    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('isBlocked', () => {
    it('should return false when there are no failed attempts', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.isBlocked('user@example.com');

      expect(result).toBe(false);

      expect(redis.get).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
      );
    });

    it('should return false when failed attempts are below the limit', async () => {
      redis.get.mockResolvedValue('4');

      const result = await service.isBlocked('user@example.com');

      expect(result).toBe(false);

      expect(redis.get).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
      );
    });

    it('should return true when failed attempts reach the limit', async () => {
      redis.get.mockResolvedValue('5');

      const result = await service.isBlocked('user@example.com');

      expect(result).toBe(true);
    });

    it('should return true when failed attempts exceed the limit', async () => {
      redis.get.mockResolvedValue('10');

      const result = await service.isBlocked('user@example.com');

      expect(result).toBe(true);
    });

    it('should normalize the email before checking the Redis key', async () => {
      redis.get.mockResolvedValue(null);

      await service.isBlocked('  USER@Example.COM  ');

      expect(redis.get).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
      );
    });
  });

  describe('recordFailure', () => {
    it('should increment the failed-attempt counter', async () => {
      redis.incr.mockResolvedValue(2);

      await service.recordFailure('user@example.com');

      expect(redis.incr).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
      );
    });

    it('should set the expiration when recording the first failed attempt', async () => {
      redis.incr.mockResolvedValue(1);

      await service.recordFailure('user@example.com');

      expect(redis.incr).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
      );

      expect(redis.expire).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
        15 * 60,
      );
    });

    it('should not reset the expiration on subsequent failures', async () => {
      redis.incr.mockResolvedValue(2);

      await service.recordFailure('user@example.com');

      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('should normalize the email when recording a failure', async () => {
      redis.incr.mockResolvedValue(1);

      await service.recordFailure('  USER@Example.COM  ');

      expect(redis.incr).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
      );
    });
  });

  describe('reset', () => {
    it('should delete the failed-attempt counter', async () => {
      redis.del.mockResolvedValue(1);

      await service.reset('user@example.com');

      expect(redis.del).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
      );
    });

    it('should normalize the email when resetting', async () => {
      redis.del.mockResolvedValue(1);

      await service.reset('  USER@Example.COM  ');

      expect(redis.del).toHaveBeenCalledWith(
        'auth:login:failed:user@example.com',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the Redis connection', async () => {
      redis.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(redis.quit).toHaveBeenCalledTimes(1);
    });
  });
});
