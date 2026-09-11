import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class UserRateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;

  private readonly limit = 100;
  private readonly windowSeconds = 15 * 60;
  private readonly loadTestMode = process.env.LOAD_TEST === 'true';

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis(
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

  private getKey(userId: string): string {
    return `rate-limit:user:${userId}`;
  }

  async checkLimit(userId: string): Promise<boolean> {
    if (this.loadTestMode) {
      return true;
    }

    const key = this.getKey(userId);

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, this.windowSeconds);
    }

    return count <= this.limit;
  }

  async reset(userId: string): Promise<void> {
    await this.redis.del(this.getKey(userId));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
