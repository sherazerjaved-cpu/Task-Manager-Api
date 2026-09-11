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

import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';

import { clearDatabase, closeDatabase } from '../integration/setup/database';

import { clearRedis, closeRedis } from '../integration/setup/redis';

/**
 * ===========================================================================
 * Mail test double
 * ===========================================================================
 *
 * The E2E suite does not need real email delivery.
 * We keep the same test double used by the Task Management E2E setup.
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

  reset(): void {
    this.sentInvitations = [];
  }
}

/**
 * ===========================================================================
 * Test application
 * ===========================================================================
 */
async function createApiCorrectnessE2ETestApp(): Promise<{
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
   * The application uses trust proxy and throttling
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
  const email = overrides.email ?? `${unique('correctness-user')}@test.com`;

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
   * Auth verification is already covered by the Auth E2E/integration
   * coverage. Mark the test user verified so this suite focuses on
   * API correctness.
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
  const suffix = unique('correctness-workspace');

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Idempotency-Key', unique('idem-workspace'))
      .send({
        name: `Correctness Workspace ${suffix}`,
        slug: `correctness-workspace-${suffix}`.toLowerCase(),
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
 * Create task request
 * ===========================================================================
 */
function createTaskRequest(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
  idempotencyKey: string,
  payload: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    status?: 'pending' | 'in-progress' | 'done';
  },
) {
  return withIp(
    request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        workspaceId,

        title: payload.title,

        description: payload.description ?? 'API correctness E2E task',

        priority: payload.priority ?? 'medium',

        ...(payload.status
          ? {
              status: payload.status,
            }
          : {}),
      }),
  );
}

/**
 * ===========================================================================
 * Get task
 * ===========================================================================
 */
function getTaskRequest(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
  taskId: string,
  headers: Record<string, string> = {},
) {
  let req = request(app.getHttpServer())
    .get(`/api/v1/tasks/${taskId}`)
    .set('Authorization', `Bearer ${user.accessToken}`)
    .set('X-Workspace-Id', workspaceId)
    .query({
      workspaceId,
    });

  for (const [name, value] of Object.entries(headers)) {
    req = req.set(name, value);
  }

  return withIp(req);
}

/**
 * ===========================================================================
 * Update task
 * ===========================================================================
 */
function updateTaskRequest(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
  taskId: string,
  payload: Record<string, unknown>,
  etag?: string,
) {
  let req = request(app.getHttpServer())
    .patch(`/api/v1/tasks/${taskId}`)
    .set('Authorization', `Bearer ${user.accessToken}`)
    .set('X-Workspace-Id', workspaceId)
    .query({
      workspaceId,
    })
    .send(payload);

  if (etag !== undefined) {
    req = req.set('If-Match', etag);
  }

  return withIp(req);
}

/**
 * ===========================================================================
 * API Correctness E2E
 * ===========================================================================
 */
describe('API Correctness E2E', () => {
  let app: INestApplication;
  let mailDouble: MailTestDouble;
  let mongoConnection: Connection;

  beforeAll(async () => {
    const created = await createApiCorrectnessE2ETestApp();

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
  // IDEMPOTENCY
  // =======================================================================

  describe('Idempotency-Key', () => {
    it('returns the original result when the same creation request is retried with the same Idempotency-Key', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const idempotencyKey = unique('idem-task-retry');

      const payload = {
        title: 'Idempotent API correctness task',
        description: 'The same request will be retried.',
        priority: 'high' as const,
      };

      const firstResponse = await createTaskRequest(
        app,
        user,
        workspace._id,
        idempotencyKey,
        payload,
      );

      expect(firstResponse.status).toBe(201);

      expect(firstResponse.body._id).toBeDefined();

      const secondResponse = await createTaskRequest(
        app,
        user,
        workspace._id,
        idempotencyKey,
        payload,
      );

      expect(secondResponse.status).toBe(201);

      expect(secondResponse.body._id).toBe(firstResponse.body._id);

      expect(secondResponse.body.title).toBe(firstResponse.body.title);

      expect(secondResponse.body.description).toBe(
        firstResponse.body.description,
      );

      const storedTasks = await mongoConnection
        .collection('tasks')
        .find({
          _id: new Types.ObjectId(firstResponse.body._id),
        })
        .toArray();

      expect(storedTasks).toHaveLength(1);
    }, 30000);

    it('does not create a second task when an identical request is retried', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const idempotencyKey = unique('idem-single-task');

      const payload = {
        title: 'Exactly one task',
        description: 'Duplicate request must not duplicate persistence.',
        priority: 'medium' as const,
      };

      const firstResponse = await createTaskRequest(
        app,
        user,
        workspace._id,
        idempotencyKey,
        payload,
      );

      expect(firstResponse.status).toBe(201);

      const secondResponse = await createTaskRequest(
        app,
        user,
        workspace._id,
        idempotencyKey,
        payload,
      );

      expect(secondResponse.status).toBe(201);

      const tasks = await mongoConnection
        .collection('tasks')
        .find({
          workspace: new Types.ObjectId(workspace._id),
          title: 'Exactly one task',
        })
        .toArray();

      expect(tasks).toHaveLength(1);

      expect(tasks[0]._id.toString()).toBe(firstResponse.body._id);
    }, 30000);

    it('rejects reuse of an Idempotency-Key with a different request payload', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const idempotencyKey = unique('idem-conflict');

      const firstResponse = await createTaskRequest(
        app,
        user,
        workspace._id,
        idempotencyKey,
        {
          title: 'Original idempotent task',
          priority: 'medium',
        },
      );

      expect(firstResponse.status).toBe(201);

      const conflictingResponse = await createTaskRequest(
        app,
        user,
        workspace._id,
        idempotencyKey,
        {
          title: 'Different task payload',
          priority: 'high',
        },
      );

      expect(conflictingResponse.status).toBe(409);

      expect(conflictingResponse.body).toBeDefined();

      const tasks = await mongoConnection
        .collection('tasks')
        .find({
          workspace: new Types.ObjectId(workspace._id),
        })
        .toArray();

      expect(tasks).toHaveLength(1);

      expect(tasks[0].title).toBe('Original idempotent task');
    }, 30000);
  });

  // =======================================================================
  // ETAG
  // =======================================================================

  describe('ETag and conditional GET', () => {
    it('returns an ETag representing the current task version', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTaskRequest(
        app,
        user,
        workspace._id,
        unique('idem-etag-task'),
        {
          title: 'ETag task',
        },
      );

      expect(task.status).toBe(201);

      const response = await getTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
      );

      expect(response.status).toBe(200);

      expect(response.headers.etag).toBeDefined();

      expect(response.headers.etag).toMatch(/^"\d+"$/);

      const storedTask = await mongoConnection.collection('tasks').findOne({
        _id: new Types.ObjectId(task.body._id),
      });

      expect(storedTask).toBeTruthy();

      expect(response.headers.etag).toBe(`"${storedTask?.__v}"`);
    }, 30000);

    it('returns 304 Not Modified when If-None-Match matches the current ETag', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTaskRequest(
        app,
        user,
        workspace._id,
        unique('idem-if-none-match'),
        {
          title: 'Conditional GET task',
        },
      );

      expect(task.status).toBe(201);

      const firstGet = await getTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
      );

      expect(firstGet.status).toBe(200);

      const etag = firstGet.headers.etag;

      expect(etag).toBeDefined();

      const conditionalGet = await getTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
        {
          'If-None-Match': etag,
        },
      );

      expect(conditionalGet.status).toBe(304);

      expect(conditionalGet.headers.etag).toBe(etag);
    }, 30000);

    it('returns 304 Not Modified when If-None-Match is wildcard', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTaskRequest(
        app,
        user,
        workspace._id,
        unique('idem-if-none-wildcard'),
        {
          title: 'Wildcard conditional GET task',
        },
      );

      expect(task.status).toBe(201);

      const response = await getTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
        {
          'If-None-Match': '*',
        },
      );

      expect(response.status).toBe(304);

      expect(response.headers.etag).toBeDefined();
    }, 30000);
  });

  // =======================================================================
  // IF-MATCH
  // =======================================================================

  describe('If-Match', () => {
    it('requires If-Match when updating a task', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTaskRequest(
        app,
        user,
        workspace._id,
        unique('idem-if-match-required'),
        {
          title: 'If-Match required task',
        },
      );

      expect(task.status).toBe(201);

      const response = await updateTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
        {
          title: 'Should not update',
        },
      );

      expect(response.status).toBe(428);

      const storedTask = await mongoConnection.collection('tasks').findOne({
        _id: new Types.ObjectId(task.body._id),
      });

      expect(storedTask?.title).toBe('If-Match required task');
    }, 30000);

    it('rejects an invalid If-Match header', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTaskRequest(
        app,
        user,
        workspace._id,
        unique('idem-invalid-if-match'),
        {
          title: 'Invalid If-Match task',
        },
      );

      expect(task.status).toBe(201);

      const response = await updateTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
        {
          title: 'Should not update',
        },
        '"invalid"',
      );

      expect(response.status).toBe(400);

      const storedTask = await mongoConnection.collection('tasks').findOne({
        _id: new Types.ObjectId(task.body._id),
      });

      expect(storedTask?.title).toBe('Invalid If-Match task');
    }, 30000);

    it('updates the task when If-Match contains the current ETag', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTaskRequest(
        app,
        user,
        workspace._id,
        unique('idem-current-if-match'),
        {
          title: 'Current ETag task',
          priority: 'medium',
        },
      );

      expect(task.status).toBe(201);

      const firstGet = await getTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
      );

      expect(firstGet.status).toBe(200);

      const currentEtag = firstGet.headers.etag;

      expect(currentEtag).toBeDefined();

      const updateResponse = await updateTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
        {
          title: 'Updated with current ETag',
          priority: 'high',
        },
        currentEtag,
      );

      expect(updateResponse.status).toBe(200);

      expect(updateResponse.body.title).toBe('Updated with current ETag');

      expect(updateResponse.body.priority).toBe('high');

      expect(updateResponse.headers.etag).toBeDefined();

      expect(updateResponse.headers.etag).not.toBe(currentEtag);
    }, 30000);
  });

  // =======================================================================
  // STALE ETAG
  // =======================================================================

  describe('Stale ETag rejection', () => {
    it('rejects an update using a stale ETag and preserves the latest resource', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      const task = await createTaskRequest(
        app,
        user,
        workspace._id,
        unique('idem-stale-etag'),
        {
          title: 'Original stale ETag task',
          priority: 'medium',
        },
      );

      expect(task.status).toBe(201);

      /**
       * Obtain the initial ETag.
       */
      const firstGet = await getTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
      );

      expect(firstGet.status).toBe(200);

      const staleEtag = firstGet.headers.etag;

      expect(staleEtag).toBeDefined();

      /**
       * Perform a legitimate update with the current ETag.
       * This makes the previously captured ETag stale.
       */
      const firstUpdate = await updateTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
        {
          title: 'Latest task title',
          priority: 'high',
        },
        staleEtag,
      );

      expect(firstUpdate.status).toBe(200);

      const currentEtag = firstUpdate.headers.etag;

      expect(currentEtag).toBeDefined();

      expect(currentEtag).not.toBe(staleEtag);

      /**
       * Attempt another update using the stale ETag.
       */
      const staleUpdate = await updateTaskRequest(
        app,
        user,
        workspace._id,
        task.body._id,
        {
          title: 'Incorrect stale update',
          priority: 'low',
        },
        staleEtag,
      );

      expect(staleUpdate.status).toBe(412);

      /**
       * Verify MongoDB still contains the latest successful update.
       */
      const storedTask = await mongoConnection.collection('tasks').findOne({
        _id: new Types.ObjectId(task.body._id),
      });

      expect(storedTask).toBeTruthy();

      expect(storedTask?.title).toBe('Latest task title');

      expect(storedTask?.priority).toBe('high');

      /**
       * The stale request must not have changed the version.
       */
      expect(`"${storedTask?.__v}"`).toBe(currentEtag);
    }, 30000);
  });

  // =======================================================================
  // COMPLETE CONDITIONAL REQUEST FLOW
  // =======================================================================

  describe('Conditional request lifecycle', () => {
    it('creates, reads, conditionally updates, and rejects a stale update', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, user);

      /**
       * 1. Create.
       */
      const createResponse = await createTaskRequest(
        app,
        user,
        workspace._id,
        unique('idem-conditional-flow'),
        {
          title: 'Conditional lifecycle task',
          priority: 'low',
        },
      );

      expect(createResponse.status).toBe(201);

      const taskId = createResponse.body._id;

      expect(taskId).toBeDefined();

      /**
       * 2. Read and obtain ETag.
       */
      const initialGet = await getTaskRequest(app, user, workspace._id, taskId);

      expect(initialGet.status).toBe(200);

      const initialEtag = initialGet.headers.etag;

      expect(initialEtag).toMatch(/^"\d+"$/);

      /**
       * 3. Conditional GET using the ETag.
       */
      const notModified = await getTaskRequest(
        app,
        user,
        workspace._id,
        taskId,
        {
          'If-None-Match': initialEtag,
        },
      );

      expect(notModified.status).toBe(304);

      /**
       * 4. Conditional update using the current ETag.
       */
      const updateResponse = await updateTaskRequest(
        app,
        user,
        workspace._id,
        taskId,
        {
          title: 'Conditionally updated task',
          priority: 'high',
        },
        initialEtag,
      );

      expect(updateResponse.status).toBe(200);

      expect(updateResponse.body.title).toBe('Conditionally updated task');

      expect(updateResponse.body.priority).toBe('high');

      const newEtag = updateResponse.headers.etag;

      expect(newEtag).toMatch(/^"\d+"$/);

      expect(newEtag).not.toBe(initialEtag);

      /**
       * 5. Old ETag must now be rejected.
       */
      const staleUpdate = await updateTaskRequest(
        app,
        user,
        workspace._id,
        taskId,
        {
          title: 'Stale conditional update',
        },
        initialEtag,
      );

      expect(staleUpdate.status).toBe(412);

      /**
       * 6. Final GET must expose the successful update,
       * not the rejected stale update.
       */
      const finalGet = await getTaskRequest(app, user, workspace._id, taskId);

      expect(finalGet.status).toBe(200);

      expect(finalGet.body.title).toBe('Conditionally updated task');

      expect(finalGet.body.priority).toBe('high');

      expect(finalGet.headers.etag).toBe(newEtag);
    }, 30000);
  });
});
