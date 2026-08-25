import {
  INestApplication,
  Injectable,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { Activity } from '../../../src/activity/Schema/activity.schema';
import { AppModule } from '../../../src/app.module';
import { MailService } from '../../../src/mail/mail.service';

import { clearDatabase } from '../setup/database';
import { clearRedis } from '../setup/redis';

import { ACTIVITY_REPOSITORY } from '../../../src/activity/domain/repositories/activity.repository.interface';
import type { IActivityRepository } from '../../../src/activity/domain/repositories/activity.repository.interface';

import { ActivityAction } from '../../../src/activity/enums/activity-action.enum';
import { TaskStatus } from '../../../src/task/Enums/task-status.enum';
import { TaskPriority } from '../../../src/task/Enums/task-priority.enum';

/**
 * ===========================================================================
 * Mail test double
 * ===========================================================================
 *
 * Activity tests do not need real email delivery.
 *
 * Auth registration still uses MailService, so we replace it with a small
 * test double.
 */
@Injectable()
class MailTestDouble {
  async sendWorkspaceInvitation(): Promise<void> {}

  async sendReminderEmail(): Promise<void> {}

  async sendVerificationEmail(): Promise<void> {}

  async sendPasswordResetEmail(): Promise<void> {}
}

/**
 * ===========================================================================
 * Test application
 * ===========================================================================
 */
async function createActivityTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useClass(MailTestDouble)
    .compile();

  const app = moduleFixture.createNestApplication();

  /**
   * The application uses trust proxy and the throttler keys requests by IP.
   *
   * Integration tests therefore use different X-Forwarded-For addresses.
   */
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

  return app;
}

/**
 * ===========================================================================
 * Test user
 * ===========================================================================
 */
interface TestUser {
  userId: string;
  email: string;
  accessToken: string;
}

/**
 * ===========================================================================
 * Unique values
 * ===========================================================================
 */
let counter = 0;

function unique(prefix: string): string {
  counter += 1;

  return `${prefix}-${Date.now()}-${counter}`;
}

/**
 * ===========================================================================
 * Test IP rotation
 * ===========================================================================
 */
let ipCounter = 1;

function nextTestIp(): string {
  const current = ipCounter++;

  const octet3 = Math.floor(current / 250) + 1;
  const octet4 = (current % 250) + 1;

  return `10.0.${octet3}.${octet4}`;
}

/**
 * ===========================================================================
 * HTTP helper
 * ===========================================================================
 */
function withIp<T extends request.Test>(req: T): T {
  return req.set('X-Forwarded-For', nextTestIp()) as T;
}

/**
 * ===========================================================================
 * Register + login helper
 * ===========================================================================
 */
async function registerVerifiedUser(
  app: INestApplication,
  connection: Connection,
  overrides: {
    email?: string;
    password?: string;
  } = {},
): Promise<TestUser> {
  const email = overrides.email ?? `${unique('activity-user')}@test.com`;

  const password = overrides.password ?? 'Password123!';

  const registerResponse = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', unique('idem-register'))
      .send({
        email,
        password,
      }),
  );

  if (registerResponse.status >= 400) {
    throw new Error(
      `Register failed (${registerResponse.status}): ${JSON.stringify(
        registerResponse.body,
      )}`,
    );
  }

  /**
   * Activity tests are not testing email verification.
   *
   * Mark the user as verified directly in MongoDB.
   */
  await connection.collection('users').updateOne(
    { email },
    {
      $set: {
        emailVerified: true,
      },
    },
  );

  const loginResponse = await withIp(
    request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email,
      password,
    }),
  );

  if (loginResponse.status >= 400) {
    throw new Error(
      `Login failed (${loginResponse.status}): ${JSON.stringify(
        loginResponse.body,
      )}`,
    );
  }

  const user = await connection.collection('users').findOne({ email });

  if (!user) {
    throw new Error(`User ${email} was not found after registration`);
  }

  return {
    userId: user._id.toString(),
    email,
    accessToken: loginResponse.body.access_token,
  };
}

/**
 * ===========================================================================
 * Register verfied Admin
 * ===========================================================================
 */

async function registerVerifiedAdmin(
  app: INestApplication,
  connection: Connection,
): Promise<TestUser> {
  const email = `${unique('activity-admin')}@test.com`;
  const password = 'Password123!';

  const registerResponse = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', unique('idem-register-admin'))
      .send({
        email,
        password,
      }),
  );

  if (registerResponse.status >= 400) {
    throw new Error(
      `Admin register failed (${registerResponse.status}): ${JSON.stringify(
        registerResponse.body,
      )}`,
    );
  }

  await connection.collection('users').updateOne(
    { email },
    {
      $set: {
        emailVerified: true,
        role: 'admin',
      },
    },
  );

  const loginResponse = await withIp(
    request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email,
      password,
    }),
  );

  if (loginResponse.status >= 400) {
    throw new Error(
      `Admin login failed (${loginResponse.status}): ${JSON.stringify(
        loginResponse.body,
      )}`,
    );
  }

  const user = await connection.collection('users').findOne({ email });

  if (!user) {
    throw new Error(`Admin user ${email} was not found after registration`);
  }

  return {
    userId: user._id.toString(),
    email,
    accessToken: loginResponse.body.access_token,
  };
}

/**
 * ===========================================================================
 * Create workspace helper
 * ===========================================================================
 */
async function createWorkspace(app: INestApplication, owner: TestUser) {
  const suffix = unique('activity-workspace');

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Idempotency-Key', unique('idem-workspace'))
      .send({
        name: `Activity Workspace ${suffix}`,
        slug: `activity-${suffix}`.toLowerCase(),
      }),
  );

  if (response.status !== 201) {
    throw new Error(
      `Workspace creation failed (${response.status}): ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  const workspaceId =
    response.body._id?.toString?.() ??
    response.body.workspace?._id?.toString?.();

  if (!workspaceId) {
    throw new Error(
      `Workspace ID missing from response: ${JSON.stringify(response.body)}`,
    );
  }

  return {
    ...response.body,
    _id: workspaceId,
  };
}

/**
 * ===========================================================================
 * Create task helper
 * ===========================================================================
 *
 * Activity records require a valid Task reference.
 *
 * We intentionally create the Task directly in MongoDB rather than calling
 * POST /tasks because Task API authorization is tested separately by the
 * Task integration tests.
 *
 * This keeps the Activity tests focused on Activity behavior while still
 * using the real MongoDB database and real Task document structure.
 */
async function createTask(
  connection: Connection,
  owner: TestUser,
  workspaceId: string,
  overrides: Record<string, unknown> = {},
) {
  const taskId = new Types.ObjectId();

  const task = {
    _id: taskId,
    title: 'Integration Test Task',
    description: 'Integration test task',
    owner: new Types.ObjectId(owner.userId),
    workspace: new Types.ObjectId(workspaceId),
    status: TaskStatus.Pending,
    priority: TaskPriority.Medium,
    isDeleted: false,
    ...overrides,
  };

  await connection.collection('tasks').insertOne(task);

  return task;
}

/**
 * ===========================================================================
 * Activity helper
 * ===========================================================================
 */
async function createActivity(
  activityRepository: IActivityRepository,
  data: {
    task: string;
    user: string;
    action?: ActivityAction;
    description?: string;
    changes?: Record<string, any>;
  },
) {
  return activityRepository.create({
    task: new Types.ObjectId(data.task),
    user: new Types.ObjectId(data.user),
    action: data.action ?? ActivityAction.UPDATED,
    description: data.description,
    changes: data.changes,
  });
}

/**
 * ===========================================================================
 * Get current user's activities
 * ===========================================================================
 */
async function getMyActivities(app: INestApplication, user: TestUser) {
  return withIp(
    request(app.getHttpServer())
      .get('/api/v1/activity/me')
      .set('Authorization', `Bearer ${user.accessToken}`),
  );
}

/**
 * ===========================================================================
 * Get all activities
 * ===========================================================================
 *
 * The Activity endpoint is protected by a policy that requires workspace
 * context, so admin requests must provide X-Workspace-Id.
 */
async function getAllActivities(
  app: INestApplication,
  user: TestUser,
  workspaceId?: string,
) {
  const req = request(app.getHttpServer())
    .get('/api/v1/activity')
    .set('Authorization', `Bearer ${user.accessToken}`);

  if (workspaceId) {
    req.set('X-Workspace-Id', workspaceId);
  }

  return withIp(req);
}

/**
 * ===========================================================================
 * Activity integration tests
 * ===========================================================================
 */
describe('Activity Module (integration)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let mongoConnection: Connection;
  let activityRepository: IActivityRepository;

  beforeAll(async () => {
    app = await createActivityTestApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    activityRepository = app.get<IActivityRepository>(ACTIVITY_REPOSITORY);
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);

    await clearRedis();
  }, 30000);

  afterAll(async () => {
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // =========================================================================
  // GET MY ACTIVITY
  // =========================================================================

  describe('GET /activity/me', () => {
    it('authenticated user can retrieve their own activities', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTask(mongoConnection, user, workspace._id);

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.CREATED,
        description: 'Task created',
      });

      const response = await getMyActivities(app, user);

      expect(response.status).toBe(200);

      expect(Array.isArray(response.body)).toBe(true);

      expect(response.body.length).toBe(1);

      expect(response.body[0].action).toBe(ActivityAction.CREATED);

      expect(response.body[0].description).toBe('Task created');
    });

    it('returns an empty array when the user has no activities', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const response = await getMyActivities(app, user);

      expect(response.status).toBe(200);

      expect(response.body).toEqual([]);
    });

    it('requires authentication', async () => {
      const response = await withIp(
        request(app.getHttpServer()).get('/api/v1/activity/me'),
      );

      expect(response.status).toBe(401);
    });

    it('returns multiple activities for the authenticated user', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTask(mongoConnection, user, workspace._id);

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.CREATED,
        description: 'Task created',
      });

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.UPDATED,
        description: 'Task updated',
        changes: {
          priority: {
            old: 'medium',
            new: 'high',
          },
        },
      });

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.DELETED,
        description: 'Task deleted',
      });

      const response = await getMyActivities(app, user);

      expect(response.status).toBe(200);

      expect(response.body.length).toBe(3);
    });

    it('does not return another user activities', async () => {
      const userA = await registerVerifiedUser(app, mongoConnection);

      const userB = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, userA);

      const task = await createTask(mongoConnection, userA, workspace._id);

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: userA.userId,
        action: ActivityAction.CREATED,
        description: 'User A activity',
      });

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: userB.userId,
        action: ActivityAction.UPDATED,
        description: 'User B activity',
      });

      const response = await getMyActivities(app, userA);

      expect(response.status).toBe(200);

      expect(response.body.length).toBe(1);

      expect(response.body[0].description).toBe('User A activity');
    });

    it('returns activity changes correctly', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTask(mongoConnection, user, workspace._id);

      const changes = {
        priority: {
          old: 'medium',
          new: 'high',
        },
        status: {
          old: 'pending',
          new: 'in-progress',
        },
      };

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.UPDATED,
        description: 'Task fields changed',
        changes,
      });

      const response = await getMyActivities(app, user);

      expect(response.status).toBe(200);

      expect(response.body[0].changes).toEqual(changes);
    });

    it('returns the populated task information', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTask(mongoConnection, user, workspace._id);

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.CREATED,
      });

      const response = await getMyActivities(app, user);

      expect(response.status).toBe(200);

      expect(response.body[0].task).toBeDefined();

      expect(response.body[0].task.title).toBeDefined();
    });
  });

  // =========================================================================
  // GET ALL ACTIVITY
  // =========================================================================

  describe('GET /activity', () => {
    it('admin can retrieve all activity logs', async () => {
      const admin = await registerVerifiedAdmin(app, mongoConnection);

      const workspace = await createWorkspace(app, admin);

      const task = await createTask(mongoConnection, admin, workspace._id);

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: admin.userId,
        action: ActivityAction.CREATED,
        description: 'Admin activity',
      });

      const response = await getAllActivities(app, admin, workspace._id);

      expect(response.status).toBe(200);

      expect(Array.isArray(response.body)).toBe(true);

      expect(response.body.length).toBe(1);

      expect(response.body[0].description).toBe('Admin activity');
    });

    it('admin can retrieve activities from multiple users', async () => {
      const admin = await registerVerifiedAdmin(app, mongoConnection);

      const user = await registerVerifiedUser(app, mongoConnection);

      await mongoConnection.collection('users').updateOne(
        {
          _id: new Types.ObjectId(admin.userId),
        },
        {
          $set: {
            role: 'admin',
          },
        },
      );

      const workspace = await createWorkspace(app, admin);

      const task = await createTask(mongoConnection, admin, workspace._id);

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: admin.userId,
        action: ActivityAction.CREATED,
        description: 'Admin activity',
      });

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.UPDATED,
        description: 'User activity',
      });

      const response = await getAllActivities(app, admin, workspace._id);

      expect(response.status).toBe(200);

      expect(response.body.length).toBe(2);

      const descriptions = response.body.map(
        (activity: any) => activity.description,
      );

      expect(descriptions).toContain('Admin activity');

      expect(descriptions).toContain('User activity');
    });

    it('non-admin user cannot retrieve all activities', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const response = await getAllActivities(app, user);

      expect(response.status).toBe(403);
    });

    it('requires authentication', async () => {
      const response = await withIp(
        request(app.getHttpServer()).get('/api/v1/activity'),
      );

      expect(response.status).toBe(401);
    });

    it('returns an empty array when no activities exist', async () => {
      const admin = await registerVerifiedAdmin(app, mongoConnection);

      const workspace = await createWorkspace(app, admin);

      const response = await getAllActivities(app, admin, workspace._id);

      expect(response.status).toBe(200);

      expect(response.body).toEqual([]);
    });
  });

  // =========================================================================
  // DATABASE PERSISTENCE
  // =========================================================================

  describe('Activity persistence', () => {
    it('persists an activity in MongoDB', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTask(mongoConnection, user, workspace._id);

      const activity = await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.CREATED,
        description: 'Persisted activity',
      });

      const stored = await mongoConnection.collection('activities').findOne({
        _id: (
          activity as Activity & {
            _id: Types.ObjectId;
          }
        )._id,
      });

      expect(stored).toBeTruthy();

      expect(stored?.task.toString()).toBe(task._id.toString());

      expect(stored?.user.toString()).toBe(user.userId);

      expect(stored?.action).toBe(ActivityAction.CREATED);

      expect(stored?.description).toBe('Persisted activity');
    });

    it('stores activity changes in MongoDB', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTask(mongoConnection, user, workspace._id);

      const changes = {
        status: {
          old: 'pending',
          new: 'done',
        },
      };

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: user.userId,
        action: ActivityAction.UPDATED,
        changes,
      });

      const stored = await mongoConnection.collection('activities').findOne({
        task: new Types.ObjectId(task._id),
      });

      expect(stored).toBeTruthy();

      expect(stored?.changes).toEqual(changes);
    });

    it('supports all defined activity actions', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTask(mongoConnection, user, workspace._id);

      const actions = [
        ActivityAction.CREATED,
        ActivityAction.UPDATED,
        ActivityAction.DELETED,
        ActivityAction.COMMENT_ADDED,
        ActivityAction.COMMENT_UPDATED,
        ActivityAction.COMMENT_DELETED,
        ActivityAction.ATTACHMENT_ADDED,
        ActivityAction.ATTACHMENT_DELETED,
      ];

      for (const action of actions) {
        await createActivity(activityRepository, {
          task: task._id.toString(),
          user: user.userId,
          action,
        });
      }

      const activities = await mongoConnection
        .collection('activities')
        .find({
          user: new Types.ObjectId(user.userId),
        })
        .toArray();

      expect(activities.length).toBe(actions.length);

      const storedActions = activities.map((activity) => activity.action);

      for (const action of actions) {
        expect(storedActions).toContain(action);
      }
    });
  });

  // =========================================================================
  // USER ISOLATION
  // =========================================================================

  describe('User activity isolation', () => {
    it('each user only receives their own activities', async () => {
      const userA = await registerVerifiedUser(app, mongoConnection);

      const userB = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, userA);

      const task = await createTask(mongoConnection, userA, workspace._id);

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: userA.userId,
        action: ActivityAction.CREATED,
        description: 'Activity A',
      });

      await createActivity(activityRepository, {
        task: task._id.toString(),
        user: userB.userId,
        action: ActivityAction.UPDATED,
        description: 'Activity B',
      });

      const responseA = await getMyActivities(app, userA);

      const responseB = await getMyActivities(app, userB);

      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);

      expect(responseA.body.length).toBe(1);

      expect(responseB.body.length).toBe(1);

      expect(responseA.body[0].description).toBe('Activity A');

      expect(responseB.body[0].description).toBe('Activity B');
    });
  });
});
