import { INestApplication } from '@nestjs/common';
import { Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { OutboxEvent } from '../../src/outbox/schema/outbox-event.schema';
import { createE2EApp } from './setup/e2e-app.factory';

import { clearDatabase, closeDatabase } from '../integration/setup/database';

import { clearRedis, closeRedis } from '../integration/setup/redis';

describe('E2E - Security / Operations', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  beforeAll(async () => {
    app = await createE2EApp();

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

  // ==========================================================
  // SECURITY MIDDLEWARE
  // ==========================================================

  describe('Security middleware', () => {
    it('should apply Helmet security headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('X-Forwarded-For', '20.10.0.1')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');

      expect(response.headers['x-content-type-options']).toBe('nosniff');

      expect(response.headers).toHaveProperty('x-frame-options');

      expect(response.headers).toHaveProperty('content-security-policy');
    }, 30000);

    it('should allow configured CORS origins', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', '20.10.0.2')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    }, 30000);

    it('should reject unauthenticated access to a protected endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('X-Forwarded-For', '20.10.0.3')
        .expect(401);
    }, 30000);
  });

  // ==========================================================
  // AUTHENTICATION SECURITY
  // ==========================================================

  describe('Authentication security', () => {
    it('should reject invalid credentials', async () => {
      const email = `e2e-security-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '20.20.0.1')
        .send({
          email,
          password: 'WrongPassword123',
        })
        .expect(401);
    }, 30000);

    it('should rotate refresh tokens and reject the old token', async () => {
      const email = `e2e-refresh-${Date.now()}@example.com`;

      const password = 'Password123';

      // ------------------------------------------------------
      // Register
      // ------------------------------------------------------

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '20.20.0.2')
        .set('Idempotency-Key', `security-register-${Date.now()}`)
        .send({
          email,
          password,
        })
        .expect(201);

      // ------------------------------------------------------
      // Get verification token from outbox
      // ------------------------------------------------------

      const outboxEventModel = app.get(getModelToken(OutboxEvent.name));

      const outboxEvent = await outboxEventModel
        .findOne({
          eventType: 'EMAIL_REQUESTED',
          aggregateType: 'USER',
          'payload.emailType': 'EMAIL_VERIFICATION',
          'payload.to': email,
        })
        .sort({ createdAt: -1 })
        .lean();

      expect(outboxEvent).toBeDefined();

      const verificationToken = outboxEvent!.payload.token as string;

      expect(verificationToken).toEqual(expect.any(String));

      // ------------------------------------------------------
      // Verify email
      // ------------------------------------------------------

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', '20.20.0.3')
        .send({
          token: verificationToken,
        })
        .expect(201);

      // ------------------------------------------------------
      // Login
      // ------------------------------------------------------

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '20.20.0.4')
        .send({
          email,
          password,
        })
        .expect(201);

      const accessToken = loginResponse.body.access_token;

      const refreshToken = loginResponse.body.refresh_token;

      expect(accessToken).toEqual(expect.any(String));

      expect(refreshToken).toEqual(expect.any(String));

      // ------------------------------------------------------
      // Refresh
      // ------------------------------------------------------

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '20.20.0.5')
        .send({
          refresh_token: refreshToken,
        })
        .expect(201);

      const rotatedRefreshToken = refreshResponse.body.refresh_token;

      const rotatedAccessToken = refreshResponse.body.access_token;

      expect(rotatedAccessToken).toEqual(expect.any(String));

      expect(rotatedRefreshToken).toEqual(expect.any(String));

      expect(rotatedRefreshToken).not.toBe(refreshToken);

      // ------------------------------------------------------
      // Old token must no longer work
      // ------------------------------------------------------

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '20.20.0.6')
        .send({
          refresh_token: refreshToken,
        })
        .expect(401);

      // ------------------------------------------------------
      // Logout
      // ------------------------------------------------------

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${rotatedAccessToken}`)
        .set('X-Forwarded-For', '20.20.0.7')
        .expect(201);

      // ------------------------------------------------------
      // Rotated token must also be invalidated
      // ------------------------------------------------------

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '20.20.0.8')
        .send({
          refresh_token: rotatedRefreshToken,
        })
        .expect(401);
    }, 60000);
  });

  // ==========================================================
  // HEALTH
  // ==========================================================

  describe('Health', () => {
    it('should report that the application is alive', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('X-Forwarded-For', '20.30.0.1')
        .expect(200);

      expect(response.body).toBeDefined();

      expect(response.body.status).toBe('ok');

      expect(
        response.body.info?.application?.status ??
          response.body.application?.status,
      ).toBe('up');
    }, 30000);

    it('should report MongoDB and Redis as ready', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .set('X-Forwarded-For', '20.30.0.2')
        .expect(200);

      expect(response.body).toBeDefined();

      expect(response.body.status).toBe('ok');

      expect(response.body.info?.mongodb?.status).toBe('up');

      expect(response.body.info?.redis?.status).toBe('up');
    }, 30000);
  });

  // ==========================================================
  // METRICS
  // ==========================================================

  describe('Metrics', () => {
    it('should expose Prometheus metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);

      expect(response.text).toContain('# HELP');

      expect(response.text).toContain('# TYPE');
    }, 30000);

    it('should expose Node.js default metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.text).toContain('process_');

      expect(response.text).toContain('nodejs_');
    }, 30000);

    it('should record real HTTP requests in metrics', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('X-Forwarded-For', '20.40.0.1')
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.text).toContain('http_requests_total');

      expect(response.text).toContain('http_request_duration_seconds');

      expect(response.text).toContain('method="GET"');

      expect(response.text).toContain('route="/api/v1/health/live"');

      expect(response.text).toContain('status_code="200"');
    }, 30000);

    it('should expose HTTP request duration histogram metrics', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('X-Forwarded-For', '20.40.0.2')
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.text).toContain('http_request_duration_seconds_bucket');

      expect(response.text).toContain('http_request_duration_seconds_sum');

      expect(response.text).toContain('http_request_duration_seconds_count');
    }, 30000);

    it('should not record the metrics endpoint itself', async () => {
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(firstResponse.text).not.toMatch(
        /http_requests_total\{method="GET",route="\/api\/v1\/metrics",status_code="200"\}/,
      );

      await request(app.getHttpServer()).get('/api/v1/metrics').expect(200);

      const secondResponse = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(secondResponse.text).not.toMatch(
        /http_requests_total\{method="GET",route="\/api\/v1\/metrics",status_code="200"\}/,
      );
    }, 30000);

    it('should use Prometheus exposition format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);

      expect(response.text).toMatch(/# HELP .+\n# TYPE .+/);
    }, 30000);
  });
});
