import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';

import { AppModule } from '../../../src/app.module';

import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { clearDatabase } from '../setup/database';
import { clearRedis } from '../setup/redis';

jest.setTimeout(30000);

describe('Health Integration (experimental)', () => {
  let app: INestApplication;
  let connection: Connection;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.getHttpAdapter().getInstance().set('trust proxy', true);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'api/v',
      defaultVersion: '1',
    });

    await app.init();

    connection = app.get<Connection>(getConnectionToken());
  }, 30000);

  afterEach(async () => {
    if (connection) {
      await clearDatabase(connection);
    }

    await clearRedis();
  });

  afterAll(async () => {
    if (app) {
      await shutdownIntegrationApp(app, connection);
    }
  }, 30000);

  describe('GET /api/v1/health/live', () => {
    it('should return 200 when the application is alive', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'ok',
          info: expect.objectContaining({
            application: {
              status: 'up',
            },
          }),
        }),
      );
    });

    it('should not require MongoDB or Redis for liveness', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(response.body.status).toBe('ok');

      expect(response.body.info.application.status).toBe('up');
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('should return 200 when MongoDB and Redis are healthy', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'ok',
        }),
      );

      expect(response.body.info).toEqual(
        expect.objectContaining({
          mongodb: expect.objectContaining({
            status: 'up',
          }),
          redis: expect.objectContaining({
            status: 'up',
          }),
        }),
      );
    });

    it('should verify MongoDB readiness', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body.info.mongodb).toEqual(
        expect.objectContaining({
          status: 'up',
        }),
      );
    });

    it('should verify Redis readiness', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body.info.redis).toEqual(
        expect.objectContaining({
          status: 'up',
        }),
      );
    });

    it('should return a valid health-check response structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'ok',
          info: expect.any(Object),
          error: expect.any(Object),
          details: expect.any(Object),
        }),
      );

      expect(response.body.details).toEqual(
        expect.objectContaining({
          mongodb: expect.any(Object),
          redis: expect.any(Object),
        }),
      );
    });
  });
});
