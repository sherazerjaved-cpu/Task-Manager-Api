import { INestApplication } from '@nestjs/common';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

import { createIntegrationApp } from './test-app.factory';

import { clearDatabase, closeDatabase } from './database';

import { clearRedis, closeRedis, getTestRedis } from './redis';

describe('Integration Infrastructure', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  beforeAll(async () => {
    app = await createIntegrationApp();

    mongoConnection = app.get<Connection>(getConnectionToken());
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();
  }, 30000);

  afterAll(async () => {
    await closeRedis();

    if (mongoConnection) {
      await closeDatabase(mongoConnection);
    }

    if (app) {
      await app.close();
    }
  }, 30000);

  it('should connect to real MongoDB', async () => {
    expect(mongoConnection.readyState).toBe(1);
  });

  it('should connect to real Redis', async () => {
    const redis = getTestRedis();

    const result = await redis.ping();

    expect(result).toBe('PONG');
  });
});
