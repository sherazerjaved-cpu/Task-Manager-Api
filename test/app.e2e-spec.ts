import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { AppModule } from '../src/app.module';

describe('Task Manager API (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();

    process.env.MONGODB_URI = mongoServer.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;

    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
    await app.close();
  });

  describe('Happy Path', () => {
    it('should register, login, create task and fetch tasks', async () => {
      const email = `user${Date.now()}@test.com`;
      const password = '123456';

      // Register
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password,
        })
        .expect(201);

      expect(registerResponse.body.email).toBe(email);

      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password,
        })
        .expect(201);

      expect(loginResponse.body.access_token).toBeDefined();

      const token = loginResponse.body.access_token;

      // Create Task
      const createTaskResponse = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'E2E Task',
          description: 'Testing',
          priority: 'medium',
        })
        .expect(201);

      expect(createTaskResponse.body.title).toBe('E2E Task');

      // Fetch Tasks
      const tasksResponse = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(tasksResponse.body.data)).toBe(true);
      expect(tasksResponse.body.data.length).toBe(1);
      expect(tasksResponse.body.data[0].title).toBe('E2E Task');
    });
  });

  describe('Unauthorized', () => {
    it('should return 401 without JWT', async () => {
      await request(app.getHttpServer()).get('/api/v1/tasks').expect(401);
    });
  });

  describe('Cross User Authorization', () => {
    it('should return 403 when another user accesses a task', async () => {
      const email1 = `owner${Date.now()}@test.com`;
      const email2 = `other${Date.now()}@test.com`;

      const password = '123456';

      // Register owner
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: email1,
          password,
        })
        .expect(201);

      // Login owner
      const ownerLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: email1,
          password,
        })
        .expect(201);

      const ownerToken = ownerLogin.body.access_token;

      // Create task
      const task = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Secret Task',
          description: 'Private',
          priority: 'high',
        })
        .expect(201);

      const taskId = task.body._id;

      // Register second user
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: email2,
          password,
        })
        .expect(201);

      // Login second user
      const secondLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: email2,
          password,
        })
        .expect(201);

      const secondToken = secondLogin.body.access_token;

      // Try to access owner's task
      await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(403);
    });
  });
});
