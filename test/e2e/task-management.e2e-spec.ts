import {
  INestApplication,
  ValidationPipe,
  VersioningType,
  Injectable,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';

import { clearDatabase, closeDatabase } from '../integration/setup/database';

import { clearRedis, closeRedis } from '../integration/setup/redis';

/**
 * ===========================================================================
 * Mail test double
 * ===========================================================================
 */
@Injectable()
class MailTestDouble {
  public sentInvitations: {
    to: string;
    workspaceName: string;
    token: string;
    expiresAt: Date;
  }[] = [];

  async sendWorkspaceInvitation(
    to: string,
    workspaceName: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sentInvitations.push({
      to,
      workspaceName,
      token,
      expiresAt,
    });
  }

  async sendReminderEmail(): Promise<void> {}

  async sendVerificationEmail(): Promise<void> {}

  async sendPasswordResetEmail(): Promise<void> {}

  getLastTokenFor(email: string): string {
    const invitation = [...this.sentInvitations]
      .reverse()
      .find((item) => item.to.toLowerCase() === email.toLowerCase());

    if (!invitation) {
      throw new Error(`No invitation email captured for ${email}`);
    }

    return invitation.token;
  }

  reset(): void {
    this.sentInvitations = [];
  }
}

/**
 * ===========================================================================
 * Test application
 * ===========================================================================
 */
async function createTaskE2ETestApp(): Promise<{
  app: INestApplication;
  mailDouble: MailTestDouble;
}> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useClass(MailTestDouble)
    .compile();

  const app = moduleFixture.createNestApplication();

  /**
   * The application uses trust proxy and the throttler
   * keys requests by IP.
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

  const mailDouble = app.get<MailTestDouble>(MailService);

  return {
    app,
    mailDouble,
  };
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
 * Test IPs
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
 * Register + verify + login
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
  const email = overrides.email ?? `${unique('task-user')}@test.com`;

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
   * Auth integration tests already cover the verification flow.
   * For this E2E suite, mark the user verified directly so that
   * the task tests focus on the task/workspace flow.
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
 * Create workspace
 * ===========================================================================
 */
async function createWorkspace(app: INestApplication, owner: TestUser) {
  const suffix = unique('task-workspace');

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Idempotency-Key', unique('idem-workspace'))
      .send({
        name: `Task Workspace ${suffix}`,
        slug: `task-workspace-${suffix}`.toLowerCase(),
      }),
  );

  if (response.status !== 201) {
    throw new Error(
      `Workspace creation failed (${response.status}): ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  return response.body;
}

/**
 * ===========================================================================
 * Create category
 * ===========================================================================
 *
 * The category endpoint receives workspaceId through the query string.
 *
 * Category schema:
 *
 *   owner
 *   name
 *   color
 *
 * There is NO workspaceId field in the Category schema.
 */
async function createCategory(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
) {
  const name = `Category ${unique('category')}`;

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', unique('idem-category'))
      .query({
        workspaceId,
      })
      .send({
        name,
      }),
  );

  if (response.status !== 201) {
    throw new Error(
      `Category creation failed (${response.status}): ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  return response.body;
}

/**
 * ===========================================================================
 * Create task
 * ===========================================================================
 *
 * IMPORTANT:
 *
 * Task schema uses:
 *
 *   workspace
 *   category
 *
 * NOT:
 *
 *   workspaceId
 *   categoryId
 *
 * The CreateTaskHandler also confirms this:
 *
 *   createTaskDto.workspaceId
 *   createTaskDto.category
 *
 * workspaceId is required by CreateTaskDto for the API request.
 * category is optional and is the category ObjectId.
 */
async function createTask(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
  overrides: {
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    status?: 'pending' | 'in-progress' | 'done';
    category?: string;
  } = {},
) {
  const title = overrides.title ?? `Task ${unique('task')}`;

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .set('Idempotency-Key', unique('idem-task'))
      .send({
        workspaceId,

        title,

        description: overrides.description ?? 'E2E task description',

        priority: overrides.priority ?? 'medium',

        ...(overrides.status
          ? {
              status: overrides.status,
            }
          : {}),

        ...(overrides.category
          ? {
              category: overrides.category,
            }
          : {}),
      }),
  );

  if (response.status !== 201) {
    throw new Error(
      `Task creation failed (${response.status}): ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  return response.body;
}

/**
 * ===========================================================================
 * Get task
 * ===========================================================================
 */
async function getTask(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
  taskId: string,
) {
  return withIp(
    request(app.getHttpServer())
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .query({
        workspaceId,
      }),
  );
}

/**
 * ===========================================================================
 * Update task
 * ===========================================================================
 */
async function updateTask(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
  taskId: string,
  etag: string,
  payload: Record<string, unknown>,
) {
  return withIp(
    request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .set('If-Match', etag)
      .query({
        workspaceId,
      })
      .send(payload),
  );
}

/**
 * ===========================================================================
 * Task Management E2E
 * ===========================================================================
 */
describe('Task Management E2E', () => {
  let app: INestApplication;
  let mailDouble: MailTestDouble;
  let mongoConnection: Connection;

  beforeAll(async () => {
    const created = await createTaskE2ETestApp();

    app = created.app;
    mailDouble = created.mailDouble;

    mongoConnection = app.get<Connection>(getConnectionToken());
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);

    await clearRedis();

    mailDouble.reset();
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

  // =======================================================================
  // COMPLETE TASK FLOW
  // =======================================================================

  describe('Complete task lifecycle', () => {
    it('user creates a workspace, creates a category, creates a task, reads it, updates it, and completes it', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      expect(workspace._id).toBeDefined();

      const category = await createCategory(app, user, workspace._id);

      expect(category._id).toBeDefined();

      const task = await createTask(app, user, workspace._id, {
        title: 'Build task management flow',
        description: 'Created by the Task E2E flow',
        priority: 'high',
      });

      expect(task._id).toBeDefined();

      expect(task.title).toBe('Build task management flow');

      expect(task.priority).toBe('high');

      const getResponse = await getTask(app, user, workspace._id, task._id);

      expect(getResponse.status).toBe(200);

      expect(getResponse.body._id).toBe(task._id);

      expect(getResponse.headers.etag).toBeDefined();

      const updateResponse = await updateTask(
        app,
        user,
        workspace._id,
        task._id,
        getResponse.headers.etag,
        {
          title: 'Build completed task flow',
          description: 'Updated by Task E2E',
          priority: 'medium',
        },
      );

      expect(updateResponse.status).toBe(200);

      expect(updateResponse.body.title).toBe('Build completed task flow');

      expect(updateResponse.body.priority).toBe('medium');

      expect(updateResponse.headers.etag).toBeDefined();

      const completeResponse = await updateTask(
        app,
        user,
        workspace._id,
        task._id,
        updateResponse.headers.etag,
        {
          status: 'done',
        },
      );

      expect(completeResponse.status).toBe(200);

      expect(completeResponse.body.status).toBe('done');

      const storedTask = await mongoConnection.collection('tasks').findOne({
        _id: new Types.ObjectId(task._id),
      });

      expect(storedTask).toBeTruthy();

      expect(storedTask?.status).toBe('done');

      expect(storedTask?.priority).toBe('medium');

      /**
       * The Task schema uses `workspace`, not `workspaceId`.
       */
      expect(storedTask?.workspace?.toString()).toBe(workspace._id);
    }, 30000);
  });

  // =======================================================================
  // TASK LISTING
  // =======================================================================

  describe('Task listing', () => {
    it('lists tasks belonging to the current workspace', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      await createTask(app, user, workspace._id, {
        title: 'First E2E task',
        priority: 'high',
      });

      await createTask(app, user, workspace._id, {
        title: 'Second E2E task',
        priority: 'low',
      });

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/tasks')
          .query({
            workspaceId: workspace._id,
          })
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('X-Workspace-Id', workspace._id),
      );

      expect(response.status).toBe(200);

      const tasks = Array.isArray(response.body)
        ? response.body
        : response.body.data;

      expect(Array.isArray(tasks)).toBe(true);

      expect(tasks.length).toBeGreaterThanOrEqual(2);

      expect(tasks.some((item: any) => item.title === 'First E2E task')).toBe(
        true,
      );

      expect(tasks.some((item: any) => item.title === 'Second E2E task')).toBe(
        true,
      );
    }, 30000);

    it('filters tasks by status', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      await createTask(app, user, workspace._id, {
        title: 'Pending E2E task',
        status: 'pending',
      });

      await createTask(app, user, workspace._id, {
        title: 'Completed E2E task',
        status: 'done',
      });

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/tasks')
          .query({
            workspaceId: workspace._id,
            status: 'done',
          })
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('X-Workspace-Id', workspace._id),
      );

      expect(response.status).toBe(200);

      const tasks = Array.isArray(response.body)
        ? response.body
        : response.body.data;

      expect(Array.isArray(tasks)).toBe(true);

      expect(tasks.length).toBeGreaterThanOrEqual(1);

      expect(tasks.every((item: any) => item.status === 'done')).toBe(true);
    }, 30000);
  });

  // =======================================================================
  // CATEGORY FLOW
  // =======================================================================

  describe('Category and task relationship', () => {
    it('creates a category and creates a task in the same workspace', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      expect(workspace._id).toBeDefined();

      const category = await createCategory(app, user, workspace._id);

      expect(category._id).toBeDefined();

      /**
       * The Task schema uses `category`, not `categoryId`.
       *
       * The CreateTaskHandler also checks:
       *
       *   if (createTaskDto.category)
       *
       * Therefore the E2E request must send:
       *
       *   category: category._id
       */
      const task = await createTask(app, user, workspace._id, {
        title: 'Categorized task',
        category: category._id,
      });

      expect(task._id).toBeDefined();

      expect(task.title).toBe('Categorized task');

      /**
       * Verify the actual persisted Mongo document.
       *
       * Task schema:
       *
       *   workspace: ObjectId
       *   category: ObjectId
       *
       * NOT:
       *
       *   workspaceId
       *   categoryId
       */
      const storedTask = await mongoConnection.collection('tasks').findOne({
        _id: new Types.ObjectId(task._id),
      });

      expect(storedTask).toBeTruthy();

      /**
       * Verify workspace relationship.
       */
      expect(storedTask?.workspace?.toString()).toBe(workspace._id);

      /**
       * Verify category relationship.
       */
      expect(storedTask?.category?.toString()).toBe(category._id);
    }, 30000);
  });

  // =======================================================================
  // TENANT ISOLATION
  // =======================================================================

  describe('Tenant isolation', () => {
    it('a user from Workspace B cannot read a task belonging to Workspace A', async () => {
      const userA = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, userA);

      const taskA = await createTask(app, userA, workspaceA._id, {
        title: 'Workspace A private task',
      });

      const userB = await registerVerifiedUser(app, mongoConnection);

      const workspaceB = await createWorkspace(app, userB);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/tasks/${taskA._id}`)
          .query({
            workspaceId: workspaceB._id,
          })
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .set('X-Workspace-Id', workspaceB._id),
      );

      expect(response.status).toBe(403);
    }, 30000);

    it('a user from Workspace B cannot update a task belonging to Workspace A', async () => {
      const userA = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, userA);

      const taskA = await createTask(app, userA, workspaceA._id, {
        title: 'Workspace A protected task',
      });

      const userB = await registerVerifiedUser(app, mongoConnection);

      const workspaceB = await createWorkspace(app, userB);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/tasks/${taskA._id}`)
          .query({
            workspaceId: workspaceB._id,
          })
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .set('X-Workspace-Id', workspaceB._id)
          .set('If-Match', '"0"')
          .send({
            title: 'Attempted cross tenant update',
          }),
      );

      expect(response.status).toBe(403);
    }, 30000);

    it('tasks from Workspace A are not returned when querying Workspace B', async () => {
      const userA = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, userA);

      await createTask(app, userA, workspaceA._id, {
        title: 'Workspace A task',
      });

      const userB = await registerVerifiedUser(app, mongoConnection);

      const workspaceB = await createWorkspace(app, userB);

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/tasks')
          .query({
            workspaceId: workspaceB._id,
          })
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .set('X-Workspace-Id', workspaceB._id),
      );

      expect(response.status).toBe(200);

      const tasks = Array.isArray(response.body)
        ? response.body
        : response.body.data;

      expect(Array.isArray(tasks)).toBe(true);

      expect(tasks.some((item: any) => item.title === 'Workspace A task')).toBe(
        false,
      );
    }, 30000);
  });

  // =======================================================================
  // AUTHORIZATION
  // =======================================================================

  describe('Authorization', () => {
    it('rejects task creation without authentication', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const response = await withIp(
        request(app.getHttpServer())
          .post('/api/v1/tasks')
          .set('X-Workspace-Id', workspaceId)
          .set('Idempotency-Key', unique('idem-task'))
          .send({
            workspaceId,
            title: 'Unauthorized task',
          }),
      );

      expect(response.status).toBe(401);
    });

    it('rejects task listing without authentication', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/tasks')
          .query({
            workspaceId,
          })
          .set('X-Workspace-Id', workspaceId),
      );

      expect(response.status).toBe(401);
    });

    it('rejects reading a task without authentication', async () => {
      const taskId = new Types.ObjectId().toString();

      const workspaceId = new Types.ObjectId().toString();

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/tasks/${taskId}`)
          .query({
            workspaceId,
          })
          .set('X-Workspace-Id', workspaceId),
      );

      expect(response.status).toBe(401);
    });
  });

  // =======================================================================
  // WORKSPACE CONTEXT
  // =======================================================================

  describe('Workspace context', () => {
    it('does not expose a task when the authenticated user supplies another workspace ID', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const task = await createTask(app, owner, workspace._id, {
        title: 'Workspace scoped task',
      });

      const unrelatedWorkspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/tasks/${task._id}`)
          .query({
            workspaceId: unrelatedWorkspace._id,
          })
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('X-Workspace-Id', unrelatedWorkspace._id),
      );

      expect(response.status).toBe(403);
    }, 30000);
  });
});
