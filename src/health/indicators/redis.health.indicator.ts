import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    super();

    this.redis = new Redis(this.configService.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      const result: string = await this.redis.ping();

      if (result !== 'PONG') {
        throw new Error(`Unexpected Redis response: ${result}`);
      }

      return this.getStatus(key, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message,
        }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }
}
