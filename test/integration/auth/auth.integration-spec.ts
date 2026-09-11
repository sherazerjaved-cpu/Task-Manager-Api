import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { createIntegrationApp } from '../setup/test-app.factory';
import { clearDatabase } from '../setup/database';

import { clearRedis } from '../setup/redis';

import { User, UserDocument } from '../../../src/users/Schema/user.schema';

import {
  OutboxEvent,
  OutboxEventDocument,
} from '../../../src/outbox/schema/outbox-event.schema';

import {
  EmailDelivery,
  EmailDeliveryDocument,
} from '../../../src/mail/schema/email-delivery.schema';

import {
  AuditLog,
  AuditLogDocument,
} from '../../../src/audit/schema/audit-log.schema';

describe('Auth Integration', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  let userModel: Model<UserDocument>;
  let outboxEventModel: Model<OutboxEventDocument>;
  let emailDeliveryModel: Model<EmailDeliveryDocument>;
  let auditLogModel: Model<AuditLogDocument>;

  beforeAll(async () => {
    app = await createIntegrationApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    outboxEventModel = app.get<Model<OutboxEventDocument>>(
      getModelToken(OutboxEvent.name),
    );

    emailDeliveryModel = app.get<Model<EmailDeliveryDocument>>(
      getModelToken(EmailDelivery.name),
    );

    auditLogModel = app.get<Model<AuditLogDocument>>(
      getModelToken(AuditLog.name),
    );
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();
  }, 30000);

  afterAll(async () => {
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // ============================================================
  // REGISTER
  // ============================================================

  describe('POST /api/v1/auth/register', () => {
    it('should register a user and persist all registration side effects', async () => {
      const email = 'auth-register@example.com';
      const password = 'Password123';

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.1')
        .set('Idempotency-Key', 'auth-register-test-1')
        .send({
          email,
          password,
        })
        .expect(201);

      expect(response.body).toBeDefined();

      const user = await userModel
        .findOne({ email })
        .select(
          '+password +emailVerificationTokenHash +emailVerificationExpiresAt',
        )
        .lean();

      expect(user).toBeDefined();

      expect(user!.email).toBe(email);
      expect(user!.emailVerified).toBe(false);

      expect(user!.password).not.toBe(password);

      const passwordMatches = await bcrypt.compare(password, user!.password);

      expect(passwordMatches).toBe(true);

      expect(user!.emailVerificationTokenHash).toBeDefined();

      expect(user!.emailVerificationExpiresAt).toBeDefined();

      const emailDelivery = await emailDeliveryModel
        .findOne({
          to: email,
          emailType: 'EMAIL_VERIFICATION',
        })
        .lean();

      expect(emailDelivery).toBeDefined();
      expect(emailDelivery!.status).toBeDefined();

      const outboxEvent = await outboxEventModel
        .findOne({
          eventType: 'EMAIL_REQUESTED',
          aggregateType: 'USER',
          aggregateId: user!._id,
        })
        .lean();

      expect(outboxEvent).toBeDefined();

      expect(outboxEvent!.payload).toBeDefined();

      expect(outboxEvent!.payload.emailType).toBe('EMAIL_VERIFICATION');

      expect(outboxEvent!.payload.to).toBe(email);

      expect(outboxEvent!.payload.token).toBeDefined();

      const verificationToken = outboxEvent!.payload.token as string;

      expect(verificationToken).toEqual(expect.any(String));

      const auditLog = await auditLogModel
        .findOne({
          actorId: user!._id,
          action: 'USER_REGISTERED',
          resource: 'USER',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      const email = 'duplicate@example.com';
      const password = 'Password123';

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.2')
        .set('Idempotency-Key', 'auth-duplicate-test-1')
        .send({
          email,
          password,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.2')
        .set('Idempotency-Key', 'auth-duplicate-test-2')
        .send({
          email,
          password,
        })
        .expect(409);

      const users = await userModel.find({ email }).lean();

      expect(users).toHaveLength(1);
    });
  });

  // ============================================================
  // EMAIL VERIFICATION
  // ============================================================

  describe('POST /api/v1/auth/verify-email', () => {
    it('should verify a user email successfully', async () => {
      const email = 'auth-verify@example.com';
      const password = 'Password123';

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.20')
        .set('Idempotency-Key', 'auth-verify-register-test')
        .send({
          email,
          password,
        })
        .expect(201);

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

      expect(outboxEvent!.payload.token).toEqual(expect.any(String));

      const verificationToken = outboxEvent!.payload.token as string;

      const userBeforeVerification = await userModel
        .findOne({ email })
        .select('+emailVerificationTokenHash +emailVerificationExpiresAt')
        .lean();

      expect(userBeforeVerification).toBeDefined();
      expect(userBeforeVerification!.emailVerified).toBe(false);

      expect(userBeforeVerification!.emailVerificationTokenHash).toBeDefined();

      expect(userBeforeVerification!.emailVerificationExpiresAt).toBeDefined();

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', '10.0.0.20')
        .send({
          token: verificationToken,
        })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Email verified successfully',
      });

      const userAfterVerification = await userModel
        .findOne({ email })
        .select('+emailVerificationTokenHash +emailVerificationExpiresAt')
        .lean();

      expect(userAfterVerification).toBeDefined();
      expect(userAfterVerification!.emailVerified).toBe(true);

      expect(userAfterVerification!.emailVerificationTokenHash).toBeUndefined();

      expect(userAfterVerification!.emailVerificationExpiresAt).toBeUndefined();

      const auditLog = await auditLogModel
        .findOne({
          actorId: userAfterVerification!._id,
          action: 'EMAIL_VERIFIED',
          resource: 'USER',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });

    it('should reject an invalid verification token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', '10.0.0.21')
        .send({
          token: 'invalid-verification-token',
        })
        .expect(400);

      expect(response.body).toBeDefined();

      const auditLog = await auditLogModel
        .findOne({
          action: 'EMAIL_VERIFICATION_FAILED',
          resource: 'AUTH',
          'meta.reason': 'invalid_or_expired_token',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });

    it('should reject an expired verification token', async () => {
      const email = 'auth-expired-verify@example.com';
      const password = 'Password123';

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.22')
        .set('Idempotency-Key', 'auth-expired-verify-register')
        .send({
          email,
          password,
        })
        .expect(201);

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
      expect(outboxEvent!.payload.token).toEqual(expect.any(String));

      const verificationToken = outboxEvent!.payload.token as string;

      const user = await userModel
        .findOne({ email })
        .select('+emailVerificationTokenHash +emailVerificationExpiresAt')
        .lean();

      expect(user).toBeDefined();

      await userModel.updateOne(
        { _id: user!._id },
        {
          $set: {
            emailVerificationExpiresAt: new Date(Date.now() - 1000),
          },
        },
      );

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', '10.0.0.23')
        .send({
          token: verificationToken,
        })
        .expect(400);

      const unchangedUser = await userModel
        .findOne({ email })
        .select('+emailVerificationTokenHash +emailVerificationExpiresAt')
        .lean();

      expect(unchangedUser).toBeDefined();
      expect(unchangedUser!.emailVerified).toBe(false);

      const auditLog = await auditLogModel
        .findOne({
          action: 'EMAIL_VERIFICATION_FAILED',
          resource: 'AUTH',
          'meta.reason': 'invalid_or_expired_token',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });
  });

  // ============================================================
  // LOGIN
  // ============================================================

  describe('POST /api/v1/auth/login', () => {
    const email = 'auth-login@example.com';
    const password = 'Password123';

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.3')
        .set('Idempotency-Key', `login-register-${Date.now()}`)
        .send({
          email,
          password,
        })
        .expect(201);

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

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', '10.0.0.3')
        .send({
          token: verificationToken,
        })
        .expect(201);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.4')
        .send({
          email,
          password,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
        }),
      );

      const user = await userModel
        .findOne({ email })
        .select('+refreshTokenHash +currentTokenId')
        .lean();

      expect(user).toBeDefined();
      expect(user!.refreshTokenHash).toBeDefined();
      expect(user!.currentTokenId).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.5')
        .send({
          email,
          password: 'WrongPassword123',
        })
        .expect(401);
    });
  });

  // ============================================================
  // REFRESH TOKEN
  // ============================================================

  describe('POST /api/v1/auth/refresh', () => {
    const email = 'auth-refresh@example.com';
    const password = 'Password123';

    let refreshToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.10')
        .set('Idempotency-Key', 'refresh-register-test')
        .send({
          email,
          password,
        });

      expect(registerResponse.status).toBe(201);

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

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', '10.0.0.6')
        .send({
          token: verificationToken,
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.6')
        .send({
          email,
          password,
        })
        .expect(201);

      refreshToken = loginResponse.body.refresh_token;

      expect(refreshToken).toEqual(expect.any(String));
    });

    it('should refresh access and refresh tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '10.0.0.20')
        .send({
          refresh_token: refreshToken,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
        }),
      );

      expect(response.body.refresh_token).not.toBe(refreshToken);
    });

    it('should reject reuse of the old refresh token after rotation', async () => {
      const firstRefreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '10.0.0.21')
        .send({
          refresh_token: refreshToken,
        })
        .expect(201);

      const rotatedRefreshToken = firstRefreshResponse.body.refresh_token;

      expect(rotatedRefreshToken).toEqual(expect.any(String));

      expect(rotatedRefreshToken).not.toBe(refreshToken);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '10.0.0.22')
        .send({
          refresh_token: refreshToken,
        })
        .expect(401);

      const user = await userModel
        .findOne({ email })
        .select('+refreshTokenHash +currentTokenId')
        .lean();

      expect(user).toBeDefined();

      expect(user!.refreshTokenHash).toBeNull();
      expect(user!.currentTokenId).toBeNull();
      expect(user!.tokenFamily).toBeNull();

      const auditLog = await auditLogModel
        .findOne({
          actorId: user!._id,
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          resource: 'AUTH',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });

    it('should reject an invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '10.0.0.23')
        .send({
          refresh_token: 'invalid-refresh-token',
        })
        .expect(401);

      const auditLog = await auditLogModel
        .findOne({
          action: 'REFRESH_TOKEN_FAILED',
          resource: 'AUTH',
          'meta.reason': 'invalid_token',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });
  });

  // ============================================================
  // LOGOUT
  // ============================================================

  describe('POST /api/v1/auth/logout', () => {
    const email = 'auth-logout@example.com';
    const password = 'Password123';

    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.30')
        .set('Idempotency-Key', 'logout-register-test')
        .send({
          email,
          password,
        })
        .expect(201);

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

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', '10.0.0.31')
        .send({
          token: verificationToken,
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.0.32')
        .send({
          email,
          password,
        })
        .expect(201);

      accessToken = loginResponse.body.access_token;
      refreshToken = loginResponse.body.refresh_token;
    });

    it('should logout an authenticated user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body).toEqual({
        message: 'Logged out successfully',
      });

      const user = await userModel
        .findOne({ email })
        .select('+refreshTokenHash +currentTokenId')
        .lean();

      expect(user).toBeDefined();

      expect(user!.refreshTokenHash).toBeNull();
      expect(user!.currentTokenId).toBeNull();
      expect(user!.tokenFamily).toBeNull();

      const auditLog = await auditLogModel
        .findOne({
          actorId: user!._id,
          action: 'LOGOUT_SUCCESS',
          resource: 'AUTH',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });

    it('should invalidate the refresh token after logout', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '10.0.0.33')
        .send({
          refresh_token: refreshToken,
        })
        .expect(401);
    });
  });

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should create a password reset request and persist its side effects', async () => {
      const email = 'auth-forgot@example.com';
      const password = 'Password123';

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.40')
        .set('Idempotency-Key', 'forgot-register-test')
        .send({
          email,
          password,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.0.41')
        .send({
          email,
        })
        .expect(201);

      expect(response.body).toEqual({
        message:
          'If an account with that email exists, a password reset email has been sent.',
      });

      const user = await userModel
        .findOne({ email })
        .select('+passwordResetTokenHash +passwordResetExpiresAt')
        .lean();

      expect(user).toBeDefined();

      expect(user!.passwordResetTokenHash).toBeDefined();
      expect(user!.passwordResetExpiresAt).toBeDefined();

      const emailDelivery = await emailDeliveryModel
        .findOne({
          to: email,
          emailType: 'PASSWORD_RESET',
        })
        .lean();

      expect(emailDelivery).toBeDefined();

      const outboxEvent = await outboxEventModel
        .findOne({
          eventType: 'EMAIL_REQUESTED',
          aggregateType: 'USER',
          aggregateId: user!._id,
          'payload.emailType': 'PASSWORD_RESET',
        })
        .sort({ createdAt: -1 })
        .lean();

      expect(outboxEvent).toBeDefined();

      expect(outboxEvent!.payload.to).toBe(email);
      expect(outboxEvent!.payload.token).toEqual(expect.any(String));

      const auditLog = await auditLogModel
        .findOne({
          actorId: user!._id,
          action: 'PASSWORD_RESET_REQUESTED',
          resource: 'AUTH',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });
  });

  // ============================================================
  // RESET PASSWORD
  // ============================================================

  describe('POST /api/v1/auth/reset-password', () => {
    const email = 'auth-reset@example.com';
    const oldPassword = 'Password123';
    const newPassword = 'NewPassword123';

    let resetToken: string;

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '10.0.0.50')
        .set('Idempotency-Key', 'reset-register-test')
        .send({
          email,
          password: oldPassword,
        })
        .expect(201);

      const forgotResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.0.51')
        .send({
          email,
        })
        .expect(201);

      expect(forgotResponse.body).toBeDefined();

      const outboxEvent = await outboxEventModel
        .findOne({
          eventType: 'EMAIL_REQUESTED',
          aggregateType: 'USER',
          'payload.emailType': 'PASSWORD_RESET',
          'payload.to': email,
        })
        .sort({ createdAt: -1 })
        .lean();

      expect(outboxEvent).toBeDefined();

      expect(outboxEvent!.payload.token).toEqual(expect.any(String));

      resetToken = outboxEvent!.payload.token as string;
    });

    it('should reset the password successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', '10.0.0.52')
        .send({
          token: resetToken,
          newPassword,
        })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Password reset successfully',
      });

      const user = await userModel
        .findOne({ email })
        .select(
          '+password +passwordResetTokenHash +passwordResetExpiresAt +refreshTokenHash +currentTokenId',
        )
        .lean();

      expect(user).toBeDefined();

      const newPasswordMatches = await bcrypt.compare(
        newPassword,
        user!.password,
      );

      expect(newPasswordMatches).toBe(true);

      const oldPasswordMatches = await bcrypt.compare(
        oldPassword,
        user!.password,
      );

      expect(oldPasswordMatches).toBe(false);

      expect(user!.passwordResetTokenHash).toBeUndefined();

      expect(user!.passwordResetExpiresAt).toBeUndefined();

      expect(user!.refreshTokenHash).toBeNull();
      expect(user!.currentTokenId).toBeNull();
      expect(user!.tokenFamily).toBeNull();

      const auditLog = await auditLogModel
        .findOne({
          actorId: user!._id,
          action: 'PASSWORD_RESET_COMPLETED',
          resource: 'USER',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });

    it('should reject an invalid password reset token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', '10.0.0.53')
        .send({
          token: 'invalid-password-reset-token',
          newPassword,
        })
        .expect(400);

      const auditLog = await auditLogModel
        .findOne({
          action: 'PASSWORD_RESET_FAILED',
          resource: 'AUTH',
          'meta.reason': 'invalid_or_expired_token',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });

    it('should reject an expired password reset token', async () => {
      const user = await userModel
        .findOne({ email })
        .select('+passwordResetTokenHash +passwordResetExpiresAt')
        .lean();

      expect(user).toBeDefined();

      await userModel.updateOne(
        { _id: user!._id },
        {
          $set: {
            passwordResetExpiresAt: new Date(Date.now() - 1000),
          },
        },
      );

      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', '10.0.0.54')
        .send({
          token: resetToken,
          newPassword,
        })
        .expect(400);

      const unchangedUser = await userModel
        .findOne({ email })
        .select('+passwordResetTokenHash +passwordResetExpiresAt')
        .lean();

      expect(unchangedUser).toBeDefined();

      expect(unchangedUser!.passwordResetTokenHash).toBeDefined();

      const auditLog = await auditLogModel
        .findOne({
          action: 'PASSWORD_RESET_FAILED',
          resource: 'AUTH',
          'meta.reason': 'invalid_or_expired_token',
        })
        .lean();

      expect(auditLog).toBeDefined();
    });
  });
});
