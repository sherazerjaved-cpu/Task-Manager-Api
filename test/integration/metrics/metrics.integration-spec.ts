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
import { MetricsInterceptor } from '../../../src/metrics/presentation/metrics.interceptor';

import { shutdownIntegrationApp } from '../helpers/shutdown-helper';

import { clearDatabase } from '../setup/database';

import { clearRedis } from '../setup/redis';

jest.setTimeout(30000);

describe('Metrics Integration', () => {
  let app: INestApplication;
  let connection: Connection;

  beforeAll(async () => {
    /**
     * -----------------------------------------------------------------------
     * Experimental bootstrap
     * -----------------------------------------------------------------------
     *
     * This intentionally follows the same loading pattern as the working
     * Workspace integration test.
     *
     * We are NOT importing test-env.ts and we are NOT using
     * createIntegrationApp().
     */
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

    app.useGlobalInterceptors(app.get(MetricsInterceptor));

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

  describe('GET /api/v1/metrics', () => {
    it('should return Prometheus metrics successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should expose default Node.js metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.text).toContain('process_');
      expect(response.text).toContain('nodejs_');
    });

    it('should expose HTTP request counter metrics', async () => {
      // Make a request first so the interceptor records it.
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.text).toContain('http_requests_total');

      expect(response.text).toContain('http_request_duration_seconds');

      expect(response.text).toContain('method="GET"');

      expect(response.text).toContain('route="/api/v1/health/live"');

      expect(response.text).toContain('status_code="200"');
    });

    it('should expose HTTP request duration histogram metrics', async () => {
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.text).toContain('http_request_duration_seconds_bucket');

      expect(response.text).toContain('http_request_duration_seconds_sum');

      expect(response.text).toContain('http_request_duration_seconds_count');
    });

    it('should not record the metrics endpoint itself', async () => {
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      const firstCountMatch = firstResponse.text.match(
        /http_requests_total\{method="GET",route="\/api\/v1\/metrics",status_code="200"\}\s+([0-9.]+)/,
      );

      expect(firstCountMatch).toBeNull();

      await request(app.getHttpServer()).get('/api/v1/metrics').expect(200);

      const secondResponse = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      const secondCountMatch = secondResponse.text.match(
        /http_requests_total\{method="GET",route="\/api\/v1\/metrics",status_code="200"\}\s+([0-9.]+)/,
      );

      expect(secondCountMatch).toBeNull();
    });

    it('should use the Prometheus exposition format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);

      expect(response.text).toMatch(/# HELP .+\n# TYPE .+/);
    });
  });
});
