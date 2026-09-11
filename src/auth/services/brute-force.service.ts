import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class BruteForceService implements OnModuleDestroy {
  private readonly redis: Redis;

  private readonly maxAttempts = 5;

  private readonly windowSeconds = 15 * 60;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis(
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

  private getKey(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();

    return `auth:login:failed:${normalizedEmail}`;
  }

  async isBlocked(email: string): Promise<boolean> {
    const attempts = await this.redis.get(this.getKey(email));

    return attempts !== null && Number(attempts) >= this.maxAttempts;
  }

  async recordFailure(email: string): Promise<void> {
    const key = this.getKey(email);

    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      await this.redis.expire(key, this.windowSeconds);
    }
  }

  async reset(email: string): Promise<void> {
    await this.redis.del(this.getKey(email));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
