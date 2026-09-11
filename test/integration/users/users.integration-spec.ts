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

describe('Users Integration', () => {
  let app: INestApplication;
  let mongoConnection: Connection;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    app = await createIntegrationApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();
  }, 30000);

  afterAll(async () => {
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // ============================================================
  // TEST HELPERS
  // ============================================================

  let testIpCounter = 1;

  function getTestIp(): string {
    return `20.0.0.${testIpCounter++}`;
  }

  async function createAdminAndGetAccessToken(): Promise<string> {
    const email = 'users-admin@example.com';
    const password = 'AdminPassword123';

    const passwordHash = await bcrypt.hash(password, 10);

    await userModel.create({
      email,
      password: passwordHash,
      role: 'admin',
      emailVerified: true,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', getTestIp())
      .send({
        email,
        password,
      })
      .expect(201);

    expect(response.body.access_token).toEqual(expect.any(String));

    return response.body.access_token;
  }

  async function createUserAndGetAccessToken(): Promise<string> {
    const email = 'users-member@example.com';
    const password = 'UserPassword123';

    const passwordHash = await bcrypt.hash(password, 10);

    await userModel.create({
      email,
      password: passwordHash,
      role: 'user',
      emailVerified: true,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '20.0.0.2')
      .send({
        email,
        password,
      })
      .expect(201);

    expect(response.body.access_token).toEqual(expect.any(String));

    return response.body.access_token;
  }

  async function createUser(
    email: string,
    role: 'user' | 'admin' = 'user',
  ): Promise<UserDocument> {
    const passwordHash = await bcrypt.hash('Password123', 10);

    return userModel.create({
      email,
      password: passwordHash,
      role,
      emailVerified: true,
    });
  }

  // ============================================================
  // GET USERS
  // ============================================================

  describe('GET /api/v1/users', () => {
    it('should allow an admin to retrieve all users', async () => {
      const accessToken = await createAdminAndGetAccessToken();

      await createUser('users-one@example.com');
      await createUser('users-two@example.com');

      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));

      expect(response.body).toHaveLength(3);

      const emails = response.body.map((user: UserDocument) => user.email);

      expect(emails).toEqual(
        expect.arrayContaining([
          'users-admin@example.com',
          'users-one@example.com',
          'users-two@example.com',
        ]),
      );
    });

    it('should not expose user passwords', async () => {
      const accessToken = await createAdminAndGetAccessToken();

      await createUser('users-password@example.com');

      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));

      for (const user of response.body) {
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('refreshTokenHash');
        expect(user).not.toHaveProperty('currentTokenId');
        expect(user).not.toHaveProperty('emailVerificationTokenHash');
        expect(user).not.toHaveProperty('emailVerificationExpiresAt');
        expect(user).not.toHaveProperty('passwordResetTokenHash');
        expect(user).not.toHaveProperty('passwordResetExpiresAt');
      }
    });

    it('should return 401 for an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/v1/users').expect(401);
    });

    it('should return 403 for a normal user', async () => {
      const accessToken = await createUserAndGetAccessToken();

      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  // ============================================================
  // DELETE USER
  // ============================================================

  describe('DELETE /api/v1/users/:id', () => {
    it('should allow an admin to delete a user', async () => {
      const accessToken = await createAdminAndGetAccessToken();

      const user = await createUser('users-delete@example.com');

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/users/${user._id.toString()}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'User Deleted Successfully',
      });
    });

    it('should remove the user from MongoDB after deletion', async () => {
      const accessToken = await createAdminAndGetAccessToken();

      const user = await createUser('users-delete-persisted@example.com');

      const userId = user._id.toString();

      await request(app.getHttpServer())
        .delete(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const deletedUser = await userModel.findById(userId).lean();

      expect(deletedUser).toBeNull();
    });

    it('should invalidate the users list cache after deletion', async () => {
      const accessToken = await createAdminAndGetAccessToken();

      const user = await createUser('users-cache-delete@example.com');

      const userId = user._id.toString();

      // --------------------------------------------------------
      // First GET populates users:all cache
      // --------------------------------------------------------

      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(
        firstResponse.body.some(
          (item: UserDocument) =>
            item.email === 'users-cache-delete@example.com',
        ),
      ).toBe(true);

      // --------------------------------------------------------
      // Delete user
      // --------------------------------------------------------

      await request(app.getHttpServer())
        .delete(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // --------------------------------------------------------
      // Second GET must not return deleted user
      // --------------------------------------------------------

      const secondResponse = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(
        secondResponse.body.some(
          (item: UserDocument) =>
            item.email === 'users-cache-delete@example.com',
        ),
      ).toBe(false);
    });

    it('should return 404 when deleting a nonexistent user', async () => {
      const accessToken = await createAdminAndGetAccessToken();

      const nonexistentUserId = '507f1f77bcf86cd799439011';

      await request(app.getHttpServer())
        .delete(`/api/v1/users/${nonexistentUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 401 when deleting a user without authentication', async () => {
      const user = await createUser('users-unauthenticated-delete@example.com');

      await request(app.getHttpServer())
        .delete(`/api/v1/users/${user._id.toString()}`)
        .expect(401);
    });

    it('should return 403 when a normal user tries to delete a user', async () => {
      const accessToken = await createUserAndGetAccessToken();

      const targetUser = await createUser('users-forbidden-delete@example.com');

      await request(app.getHttpServer())
        .delete(`/api/v1/users/${targetUser._id.toString()}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      // Confirm the target user was not deleted.
      const persistedUser = await userModel.findById(targetUser._id).lean();

      expect(persistedUser).toBeDefined();
    });
  });
});
