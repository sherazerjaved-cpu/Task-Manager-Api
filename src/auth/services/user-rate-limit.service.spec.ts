import { UserRateLimitService } from './user-rate-limit.service';

jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    get: jest.fn(),
  }));

  return RedisMock;
});

describe('UserRateLimitService', () => {
  let service: UserRateLimitService;
  let redisMock: {
    incr: jest.Mock;
    expire: jest.Mock;
    del: jest.Mock;
    quit: jest.Mock;
    get: jest.Mock;
  };

  const configService = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UserRateLimitService(configService);

    redisMock = (service as any).redis;
  });

  afterEach(() => {
    delete process.env.LOAD_TEST;
  });

  describe('checkLimit', () => {
    it('should allow the request when count is within the limit', async () => {
      redisMock.incr.mockResolvedValue(1);
      redisMock.expire.mockResolvedValue(1);

      const result = await service.checkLimit('user-123');

      expect(result).toBe(true);

      expect(redisMock.incr).toHaveBeenCalledWith('rate-limit:user:user-123');

      expect(redisMock.expire).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
        15 * 60,
      );
    });

    it('should allow requests up to the configured limit', async () => {
      redisMock.incr.mockResolvedValue(100);

      const result = await service.checkLimit('user-123');

      expect(result).toBe(true);

      expect(redisMock.incr).toHaveBeenCalledWith('rate-limit:user:user-123');

      expect(redisMock.expire).not.toHaveBeenCalled();
    });

    it('should reject the request when the limit is exceeded', async () => {
      redisMock.incr.mockResolvedValue(101);

      const result = await service.checkLimit('user-123');

      expect(result).toBe(false);

      expect(redisMock.incr).toHaveBeenCalledWith('rate-limit:user:user-123');
    });

    it('should set the expiration only for the first request', async () => {
      redisMock.incr.mockResolvedValue(1);
      redisMock.expire.mockResolvedValue(1);

      await service.checkLimit('user-123');

      expect(redisMock.expire).toHaveBeenCalledTimes(1);
      expect(redisMock.expire).toHaveBeenCalledWith(
        'rate-limit:user:user-123',
        15 * 60,
      );
    });

    it('should not set expiration for subsequent requests', async () => {
      redisMock.incr.mockResolvedValue(2);

      const result = await service.checkLimit('user-123');

      expect(result).toBe(true);
      expect(redisMock.expire).not.toHaveBeenCalled();
    });

    it('should use a separate Redis key for each user', async () => {
      redisMock.incr.mockResolvedValue(1);

      await service.checkLimit('user-123');
      await service.checkLimit('user-456');

      expect(redisMock.incr).toHaveBeenNthCalledWith(
        1,
        'rate-limit:user:user-123',
      );

      expect(redisMock.incr).toHaveBeenNthCalledWith(
        2,
        'rate-limit:user:user-456',
      );
    });

    it('should propagate Redis errors', async () => {
      const redisError = new Error('Redis connection failed');

      redisMock.incr.mockRejectedValue(redisError);

      await expect(service.checkLimit('user-123')).rejects.toThrow(
        'Redis connection failed',
      );
    });
  });

  describe('load test mode', () => {
    it('should always allow requests when LOAD_TEST=true', async () => {
      process.env.LOAD_TEST = 'true';

      // The service reads LOAD_TEST when it is constructed.
      const loadTestService = new UserRateLimitService(configService);
      const loadTestRedisMock = (loadTestService as any).redis;

      const result = await loadTestService.checkLimit('user-123');

      expect(result).toBe(true);
      expect(loadTestRedisMock.incr).not.toHaveBeenCalled();
    });

    it('should still use Redis when LOAD_TEST is not enabled', async () => {
      delete process.env.LOAD_TEST;

      redisMock.incr.mockResolvedValue(1);

      const result = await service.checkLimit('user-123');

      expect(result).toBe(true);
      expect(redisMock.incr).toHaveBeenCalledWith('rate-limit:user:user-123');
    });
  });

  describe('reset', () => {
    it('should remove the user rate-limit key', async () => {
      redisMock.del.mockResolvedValue(1);

      await service.reset('user-123');

      expect(redisMock.del).toHaveBeenCalledTimes(1);
      expect(redisMock.del).toHaveBeenCalledWith('rate-limit:user:user-123');
    });

    it('should propagate Redis errors during reset', async () => {
      const redisError = new Error('Redis delete failed');

      redisMock.del.mockRejectedValue(redisError);

      await expect(service.reset('user-123')).rejects.toThrow(
        'Redis delete failed',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the Redis connection', async () => {
      redisMock.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(redisMock.quit).toHaveBeenCalledTimes(1);
    });

    it('should propagate Redis errors when closing the connection', async () => {
      const redisError = new Error('Redis quit failed');

      redisMock.quit.mockRejectedValue(redisError);

      await expect(service.onModuleDestroy()).rejects.toThrow(
        'Redis quit failed',
      );
    });
  });
});
