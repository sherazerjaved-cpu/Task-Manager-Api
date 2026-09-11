import { INestApplication } from '@nestjs/common';
import { Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';

import { createE2EApp } from './setup/e2e-app.factory';

import { clearDatabase, closeDatabase } from '../integration/setup/database';

import { clearRedis, closeRedis } from '../integration/setup/redis';

import { User, UserDocument } from '../../src/users/Schema/user.schema';

import {
  OutboxEvent,
  OutboxEventDocument,
} from '../../src/outbox/schema/outbox-event.schema';

describe('E2E - Authentication Onboarding', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  let userModel: Model<UserDocument>;
  let outboxEventModel: Model<OutboxEventDocument>;

  beforeAll(async () => {
    app = await createE2EApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    outboxEventModel = app.get<Model<OutboxEventDocument>>(
      getModelToken(OutboxEvent.name),
    );
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

  it('should complete the full authentication onboarding lifecycle', async () => {
    const email = `e2e-auth-${Date.now()}@example.com`;
    const password = 'Password123';

    // ==========================================================
    // 1. REGISTER
    // ==========================================================

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', '10.10.0.1')
      .set('Idempotency-Key', `e2e-auth-register-${Date.now()}`)
      .send({
        email,
        password,
      })
      .expect(201);

    expect(registerResponse.body).toBeDefined();

    // ==========================================================
    // 2. SIMULATE RECEIVING THE VERIFICATION EMAIL
    //
    // The application generated the email request itself.
    // We retrieve the token from the resulting outbox event
    // rather than bypassing the verification flow.
    // ==========================================================

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

    // ==========================================================
    // 3. VERIFY EMAIL
    // ==========================================================

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', '10.10.0.2')
      .send({
        token: verificationToken,
      })
      .expect(201);

    // ==========================================================
    // 4. LOGIN
    // ==========================================================

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '10.10.0.3')
      .send({
        email,
        password,
      })
      .expect(201);

    const accessToken = loginResponse.body.access_token;

    const refreshToken = loginResponse.body.refresh_token;

    expect(accessToken).toEqual(expect.any(String));

    expect(refreshToken).toEqual(expect.any(String));

    // ==========================================================
    // 5. CREATE WORKSPACE
    //
    // This proves the authenticated user can enter the actual
    // application workflow.
    // ==========================================================

    const workspaceResponse = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Forwarded-For', '10.10.0.4')
      .set('Idempotency-Key', `e2e-workspace-${Date.now()}`)
      .send({
        name: 'E2E Workspace',
        slug: 'e2e-workspace',
      })
      .expect(201);

    expect(workspaceResponse.body).toBeDefined();

    const workspaceId = workspaceResponse.body._id ?? workspaceResponse.body.id;

    expect(workspaceId).toEqual(expect.any(String));

    // ==========================================================
    // 6. ACCESS THE WORKSPACE AS AN AUTHENTICATED USER
    // ==========================================================

    const workspaceGetResponse = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .set('X-Forwarded-For', '10.10.0.5')
      .expect(200);

    expect(workspaceGetResponse.body).toBeDefined();

    // ==========================================================
    // 7. REFRESH TOKEN
    //
    // The original refresh token should be rotated.
    // ==========================================================

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', '10.10.0.6')
      .send({
        refresh_token: refreshToken,
      })
      .expect(201);

    const rotatedRefreshToken = refreshResponse.body.refresh_token;

    const rotatedAccessToken = refreshResponse.body.access_token;

    expect(rotatedAccessToken).toEqual(expect.any(String));

    expect(rotatedRefreshToken).toEqual(expect.any(String));

    expect(rotatedRefreshToken).not.toBe(refreshToken);

    // ==========================================================
    // 8. LOGOUT
    // ==========================================================

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${rotatedAccessToken}`)
      .set('X-Forwarded-For', '10.10.0.7')
      .expect(201);

    // ==========================================================
    // 9. THE ROTATED REFRESH TOKEN MUST NOW BE INVALID
    // ==========================================================

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', '10.10.0.8')
      .send({
        refresh_token: rotatedRefreshToken,
      })
      .expect(401);

    // ==========================================================
    // Minimal final state assertion
    //
    // This confirms the HTTP journey reached the expected user.
    // Detailed persistence assertions remain covered by the
    // integration tests.
    // ==========================================================

    const user = await userModel
      .findOne({ email })
      .select('+refreshTokenHash +currentTokenId')
      .lean();

    expect(user).toBeDefined();
    expect(user!.emailVerified).toBe(true);
    expect(user!.refreshTokenHash).toBeNull();
    expect(user!.currentTokenId).toBeNull();
  }, 60000);
});
