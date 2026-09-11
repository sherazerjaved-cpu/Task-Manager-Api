import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
  IDEMPOTENCY_REDIS_PREFIX,
  IDEMPOTENCY_TTL_SECONDS,
} from './idempotency.constants';

export type IdempotencyRecordStatus = 'PROCESSING' | 'COMPLETED';

export interface IdempotencyRecord {
  status: IdempotencyRecordStatus;
  fingerprint: string;
  statusCode?: number;
  responseBody?: unknown;
}

@Injectable()
export class IdempotencyService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  private buildKey(scope: string, idempotencyKey: string): string {
    return `${IDEMPOTENCY_REDIS_PREFIX}:${scope}:${idempotencyKey}`;
  }

  async reserve(
    scope: string,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<{
    acquired: boolean;
    record?: IdempotencyRecord;
  }> {
    const key = this.buildKey(scope, idempotencyKey);

    const record: IdempotencyRecord = {
      status: 'PROCESSING',
      fingerprint,
    };

    const result = await this.redis.set(
      key,
      JSON.stringify(record),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
      'NX',
    );

    if (result === 'OK') {
      return {
        acquired: true,
      };
    }

    const existing = await this.get(scope, idempotencyKey);

    return {
      acquired: false,
      record: existing ?? undefined,
    };
  }

  async get(
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null> {
    const key = this.buildKey(scope, idempotencyKey);

    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as IdempotencyRecord;
  }

  async complete(
    scope: string,
    idempotencyKey: string,
    record: IdempotencyRecord,
  ): Promise<void> {
    const key = this.buildKey(scope, idempotencyKey);

    await this.redis.set(
      key,
      JSON.stringify({
        ...record,
        status: 'COMPLETED',
      }),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    );
  }

  async delete(scope: string, idempotencyKey: string): Promise<void> {
    const key = this.buildKey(scope, idempotencyKey);

    await this.redis.del(key);
  }
}
