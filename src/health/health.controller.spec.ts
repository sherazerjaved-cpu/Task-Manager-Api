import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';

describe('HealthController', () => {
  let controller: HealthController;

  let health: {
    check: jest.Mock;
  };

  let mongoose: {
    pingCheck: jest.Mock;
  };

  let redis: {
    isHealthy: jest.Mock;
  };

  beforeEach(() => {
    health = {
      check: jest.fn(),
    };

    mongoose = {
      pingCheck: jest.fn(),
    };

    redis = {
      isHealthy: jest.fn(),
    };

    controller = new HealthController(
      health as unknown as HealthCheckService,
      mongoose as unknown as MongooseHealthIndicator,
      redis as unknown as RedisHealthIndicator,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLiveness', () => {
    it('should perform the liveness health check', async () => {
      const result = {
        status: 'ok',
        info: {
          application: {
            status: 'up',
          },
        },
        error: {},
        details: {
          application: {
            status: 'up',
          },
        },
      };

      health.check.mockResolvedValue(result);

      const response = await controller.checkLiveness();

      expect(response).toBe(result);
      expect(health.check).toHaveBeenCalledTimes(1);
    });

    it('should pass an application liveness check to HealthCheckService', async () => {
      health.check.mockImplementation(
        async (checks: Array<() => Promise<any>>) => {
          expect(checks).toHaveLength(1);

          const checkResult = await checks[0]();

          expect(checkResult).toEqual({
            application: {
              status: 'up',
            },
          });

          return {
            status: 'ok',
          };
        },
      );

      await controller.checkLiveness();

      expect(health.check).toHaveBeenCalledTimes(1);
    });

    it('should report the application as up', async () => {
      health.check.mockImplementation(
        async (checks: Array<() => Promise<any>>) => {
          const checkResult = await checks[0]();

          expect(checkResult.application.status).toBe('up');

          return {
            status: 'ok',
          };
        },
      );

      await controller.checkLiveness();

      expect(health.check).toHaveBeenCalledTimes(1);
    });

    it('should return the HealthCheckService result', async () => {
      const result = {
        status: 'ok',
      };

      health.check.mockResolvedValue(result);

      const response = await controller.checkLiveness();

      expect(response).toBe(result);
    });

    it('should propagate HealthCheckService errors', async () => {
      const error = new Error('Health check failed');

      health.check.mockRejectedValue(error);

      await expect(controller.checkLiveness()).rejects.toBe(error);
    });
  });

  describe('checkReadiness', () => {
    it('should perform the readiness health check', async () => {
      const result = {
        status: 'ok',
        info: {
          mongodb: {
            status: 'up',
          },
          redis: {
            status: 'up',
          },
        },
        error: {},
        details: {
          mongodb: {
            status: 'up',
          },
          redis: {
            status: 'up',
          },
        },
      };

      health.check.mockResolvedValue(result);

      const response = await controller.checkReadiness();

      expect(response).toBe(result);
      expect(health.check).toHaveBeenCalledTimes(1);
    });

    it('should include MongoDB and Redis checks', async () => {
      mongoose.pingCheck.mockResolvedValue({
        mongodb: {
          status: 'up',
        },
      });

      redis.isHealthy.mockResolvedValue({
        redis: {
          status: 'up',
        },
      });

      health.check.mockImplementation(
        async (checks: Array<() => Promise<any>>) => {
          expect(checks).toHaveLength(2);

          const results = await Promise.all(checks.map((check) => check()));

          expect(results).toEqual([
            {
              mongodb: {
                status: 'up',
              },
            },
            {
              redis: {
                status: 'up',
              },
            },
          ]);

          return {
            status: 'ok',
          };
        },
      );

      await controller.checkReadiness();

      expect(health.check).toHaveBeenCalledTimes(1);
    });

    it('should call the MongoDB health check with the mongodb key', async () => {
      mongoose.pingCheck.mockResolvedValue({
        mongodb: {
          status: 'up',
        },
      });

      redis.isHealthy.mockResolvedValue({
        redis: {
          status: 'up',
        },
      });

      health.check.mockImplementation(
        async (checks: Array<() => Promise<any>>) => {
          await checks[0]();

          return {
            status: 'ok',
          };
        },
      );

      await controller.checkReadiness();

      expect(mongoose.pingCheck).toHaveBeenCalledTimes(1);
      expect(mongoose.pingCheck).toHaveBeenCalledWith('mongodb');
    });

    it('should call the Redis health check with the redis key', async () => {
      mongoose.pingCheck.mockResolvedValue({
        mongodb: {
          status: 'up',
        },
      });

      redis.isHealthy.mockResolvedValue({
        redis: {
          status: 'up',
        },
      });

      health.check.mockImplementation(
        async (checks: Array<() => Promise<any>>) => {
          await checks[1]();

          return {
            status: 'ok',
          };
        },
      );

      await controller.checkReadiness();

      expect(redis.isHealthy).toHaveBeenCalledTimes(1);
      expect(redis.isHealthy).toHaveBeenCalledWith('redis');
    });

    it('should execute both MongoDB and Redis checks', async () => {
      mongoose.pingCheck.mockResolvedValue({
        mongodb: {
          status: 'up',
        },
      });

      redis.isHealthy.mockResolvedValue({
        redis: {
          status: 'up',
        },
      });

      health.check.mockImplementation(
        async (checks: Array<() => Promise<any>>) => {
          await Promise.all(checks.map((check) => check()));

          return {
            status: 'ok',
          };
        },
      );

      await controller.checkReadiness();

      expect(mongoose.pingCheck).toHaveBeenCalledTimes(1);
      expect(redis.isHealthy).toHaveBeenCalledTimes(1);
    });

    it('should return the HealthCheckService result', async () => {
      const result = {
        status: 'ok',
        info: {
          mongodb: {
            status: 'up',
          },
          redis: {
            status: 'up',
          },
        },
      };

      health.check.mockResolvedValue(result);

      const response = await controller.checkReadiness();

      expect(response).toBe(result);
    });

    it('should propagate HealthCheckService errors', async () => {
      const error = new Error('Readiness check failed');

      health.check.mockRejectedValue(error);

      await expect(controller.checkReadiness()).rejects.toBe(error);
    });

    it('should propagate MongoDB health check errors', async () => {
      const error = new Error('MongoDB unavailable');

      mongoose.pingCheck.mockRejectedValue(error);

      health.check.mockImplementation(
        async (checks: Array<() => Promise<any>>) => {
          return Promise.all(checks.map((check) => check()));
        },
      );

      await expect(controller.checkReadiness()).rejects.toBe(error);
    });

    it('should propagate Redis health check errors', async () => {
      const error = new Error('Redis unavailable');

      redis.isHealthy.mockRejectedValue(error);

      health.check.mockImplementation(
        async (checks: Array<() => Promise<any>>) => {
          return Promise.all(checks.map((check) => check()));
        },
      );

      await expect(controller.checkReadiness()).rejects.toBe(error);
    });
  });
});
