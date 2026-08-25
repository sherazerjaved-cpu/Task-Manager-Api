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
import { AppModule } from '../../../src/app.module';
import { MailService } from '../../../src/mail/mail.service';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { clearDatabase } from '../setup/database';
import { clearRedis } from '../setup/redis';
import { WebhookProcessor } from 'src/infrastructure/processors/webhook.processor';
import { WebhookService } from '../../../src/webhook/application/webhook.service';
import { DeadLetterService } from 'src/infrastructure/queues/dead-letter.service';
import { PROCESSED_EVENT_REPOSITORY } from '../../../src/outbox/domain/constants/repository.tokens';
import type { IProcessedEventRepository } from '../../../src/outbox/domain/repositories/processed-event.repository.interface';
import { QUEUE_NAMES } from 'src/infrastructure/queues/queue.constants';
jest.setTimeout(30000);
/**
 * ===========================================================================
 * Mail test double
 * ===========================================================================
 *
 * Webhook tests do not need real email delivery.
 * Auth registration, however, uses MailService.
 *
 * Therefore MailService is replaced with this test double.
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
async function createWebhookTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useClass(MailTestDouble)
    .compile();

  const app = moduleFixture.createNestApplication();

  /**
   * The application uses trust proxy and the throttler keys requests
   * by IP.
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
  const email = overrides.email ?? `${unique('webhook-user')}@test.com`;

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
   * Webhook tests are not testing email verification.
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
 * Workspace helper
 * ===========================================================================
 */
async function createWorkspace(app: INestApplication, owner: TestUser) {
  const suffix = unique('workspace');

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Idempotency-Key', unique('idem-workspace'))
      .send({
        name: `Webhook Workspace ${suffix}`,
        slug: `webhook-${suffix}`.toLowerCase(),
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
 * Membership helper
 * ===========================================================================
 */
async function makeMembership(
  connection: Connection,
  workspaceId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER',
): Promise<void> {
  await connection.collection('memberships').insertOne({
    workspaceId: new Types.ObjectId(workspaceId),
    userId: new Types.ObjectId(userId),
    role,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * ===========================================================================
 * Webhook helpers
 * ===========================================================================
 */
async function createWebhook(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
  overrides: {
    url?: string;
    events?: string[];
    idempotencyKey?: string;
  } = {},
) {
  return withIp(
    request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/webhooks`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set(
        'Idempotency-Key',
        overrides.idempotencyKey ?? unique('idem-webhook'),
      )
      .send({
        url: overrides.url ?? 'https://example.com/webhooks/tasks',
        events: overrides.events ?? [
          'task.created',
          'task.updated',
          'task.deleted',
        ],
      }),
  );
}

async function getWebhooks(
  app: INestApplication,
  user: TestUser,
  workspaceId: string,
) {
  return withIp(
    request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/webhooks`)
      .set('Authorization', `Bearer ${user.accessToken}`),
  );
}

/**
 * ===========================================================================
 * Webhook processor job helper
 * ===========================================================================
 *
 * The real WebhookProcessor expects a BullMQ Job.
 *
 * For integration testing we provide the minimum Job shape required by
 * WebhookProcessor.process().
 */
function createWebhookJob(
  data: Record<string, unknown>,
  options: {
    attemptsMade?: number;
    attempts?: number;
    id?: string;
  } = {},
): any {
  return {
    id: options.id ?? unique('webhook-job'),
    data,
    attemptsMade: options.attemptsMade ?? 0,
    opts: {
      attempts: options.attempts ?? 1,
    },
  };
}

/**
 * ===========================================================================
 * Webhook Module integration tests
 * ===========================================================================
 */
describe('Webhook Module (integration)', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  beforeAll(async () => {
    app = await createWebhookTestApp();

    mongoConnection = app.get<Connection>(getConnectionToken());
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();
  }, 30000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // =========================================================================
  // CREATE WEBHOOK
  // =========================================================================

  describe('Create webhook', () => {
    it('OWNER can create a webhook', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id);

      expect(response.status).toBe(201);

      expect(response.body._id).toBeDefined();

      expect(response.body.workspaceId).toBe(workspace._id);

      expect(response.body.url).toBe('https://example.com/webhooks/tasks');

      expect(response.body.events).toEqual([
        'task.created',
        'task.updated',
        'task.deleted',
      ]);
    });

    it('does not expose the webhook secret in the HTTP response', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id);

      expect(response.status).toBe(201);

      expect(response.body.secret).toBeUndefined();
    });

    it('stores the webhook in MongoDB', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id);

      expect(response.status).toBe(201);

      const webhook = await mongoConnection.collection('webhooks').findOne({
        _id: new Types.ObjectId(response.body._id),
      });

      expect(webhook).toBeTruthy();

      expect(webhook?.workspaceId.toString()).toBe(workspace._id);

      expect(webhook?.url).toBe('https://example.com/webhooks/tasks');

      expect(webhook?.active).toBe(true);

      expect(webhook?.events).toEqual([
        'task.created',
        'task.updated',
        'task.deleted',
      ]);

      expect(webhook?.secret).toBeDefined();

      expect(typeof webhook?.secret).toBe('string');
    });

    it('rejects an invalid webhook URL', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id, {
        url: 'not-a-url',
      });

      expect(response.status).toBe(400);
    });

    it('rejects a webhook URL without a protocol', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id, {
        url: 'example.com/webhook',
      });

      expect(response.status).toBe(400);
    });

    it('rejects an empty events array', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id, {
        events: [],
      });

      expect(response.status).toBe(400);
    });

    it('rejects non-string events', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id, {
        events: ['task.created', 123 as any],
      });

      expect(response.status).toBe(400);
    });

    it('rejects a request without authentication', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/webhooks`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            url: 'https://example.com/webhook',
            events: ['task.created'],
          }),
      );

      expect(response.status).toBe(401);
    });
  });

  // =========================================================================
  // LIST WEBHOOKS
  // =========================================================================

  describe('Get workspace webhooks', () => {
    it('OWNER can list workspace webhooks', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await createWebhook(app, owner, workspace._id, {
        url: 'https://example.com/webhook-1',
      });

      await createWebhook(app, owner, workspace._id, {
        url: 'https://example.com/webhook-2',
      });

      const response = await getWebhooks(app, owner, workspace._id);

      expect(response.status).toBe(200);

      expect(Array.isArray(response.body)).toBe(true);

      expect(response.body.length).toBe(2);

      const urls = response.body.map((webhook: any) => webhook.url);

      expect(urls).toContain('https://example.com/webhook-1');

      expect(urls).toContain('https://example.com/webhook-2');
    });

    it('returns an empty array when the workspace has no webhooks', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await getWebhooks(app, owner, workspace._id);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('does not expose webhook secrets when listing webhooks', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await createWebhook(app, owner, workspace._id);

      const response = await getWebhooks(app, owner, workspace._id);

      expect(response.status).toBe(200);

      for (const webhook of response.body) {
        expect(webhook.secret).toBeUndefined();
      }
    });

    it('rejects listing webhooks without authentication', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const response = await withIp(
        request(app.getHttpServer()).get(
          `/api/v1/workspaces/${workspaceId}/webhooks`,
        ),
      );

      expect(response.status).toBe(401);
    });
  });

  // =========================================================================
  // ROLE-BASED AUTHORIZATION
  // =========================================================================

  describe('Webhook authorization', () => {
    it('ADMIN can create a webhook', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const admin = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await makeMembership(
        mongoConnection,
        workspace._id,
        admin.userId,
        'ADMIN',
      );

      const response = await createWebhook(app, admin, workspace._id);

      expect(response.status).toBe(201);
    });

    it('ADMIN can list webhooks', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const admin = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await makeMembership(
        mongoConnection,
        workspace._id,
        admin.userId,
        'ADMIN',
      );

      await createWebhook(app, owner, workspace._id);

      const response = await getWebhooks(app, admin, workspace._id);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });

    it('MEMBER cannot create a webhook', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await makeMembership(
        mongoConnection,
        workspace._id,
        member.userId,
        'MEMBER',
      );

      const response = await createWebhook(app, member, workspace._id);

      expect(response.status).toBe(403);
    });

    it('MEMBER cannot list webhooks', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await makeMembership(
        mongoConnection,
        workspace._id,
        member.userId,
        'MEMBER',
      );

      const response = await getWebhooks(app, member, workspace._id);

      expect(response.status).toBe(403);
    });

    it('VIEWER cannot create a webhook', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const viewer = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await makeMembership(
        mongoConnection,
        workspace._id,
        viewer.userId,
        'VIEWER',
      );

      const response = await createWebhook(app, viewer, workspace._id);

      expect(response.status).toBe(403);
    });

    it('VIEWER cannot list webhooks', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const viewer = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await makeMembership(
        mongoConnection,
        workspace._id,
        viewer.userId,
        'VIEWER',
      );

      const response = await getWebhooks(app, viewer, workspace._id);

      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // TENANT ISOLATION
  // =========================================================================

  describe('Tenant isolation', () => {
    it('user from Workspace A cannot create a webhook in Workspace B', async () => {
      const ownerA = await registerVerifiedUser(app, mongoConnection);

      const ownerB = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, ownerA);

      const workspaceB = await createWorkspace(app, ownerB);

      const response = await createWebhook(app, ownerA, workspaceB._id);

      expect(response.status).toBe(403);

      const webhook = await mongoConnection.collection('webhooks').findOne({
        workspaceId: new Types.ObjectId(workspaceB._id),
      });

      expect(webhook).toBeNull();

      expect(workspaceA._id).toBeDefined();
    });

    it('user from Workspace A cannot list Workspace B webhooks', async () => {
      const ownerA = await registerVerifiedUser(app, mongoConnection);

      const ownerB = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, ownerA);

      const workspaceB = await createWorkspace(app, ownerB);

      await createWebhook(app, ownerB, workspaceB._id);

      const response = await getWebhooks(app, ownerA, workspaceB._id);

      expect(response.status).toBe(403);

      expect(workspaceA._id).toBeDefined();
    });

    it('a user with no membership cannot access workspace webhooks', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const outsider = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await getWebhooks(app, outsider, workspace._id);

      expect(response.status).toBe(403);
    });

    it('webhooks from Workspace A are not returned for Workspace B', async () => {
      const ownerA = await registerVerifiedUser(app, mongoConnection);

      const ownerB = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, ownerA);

      const workspaceB = await createWorkspace(app, ownerB);

      await createWebhook(app, ownerA, workspaceA._id, {
        url: 'https://example.com/workspace-a',
      });

      await createWebhook(app, ownerB, workspaceB._id, {
        url: 'https://example.com/workspace-b',
      });

      const responseA = await getWebhooks(app, ownerA, workspaceA._id);

      const responseB = await getWebhooks(app, ownerB, workspaceB._id);

      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);

      expect(responseA.body.length).toBe(1);
      expect(responseB.body.length).toBe(1);

      expect(responseA.body[0].url).toBe('https://example.com/workspace-a');

      expect(responseB.body[0].url).toBe('https://example.com/workspace-b');
    });
  });

  // =========================================================================
  // IDEMPOTENCY
  // =========================================================================

  describe('Idempotency', () => {
    it('does not create duplicate webhooks for the same Idempotency-Key', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const idempotencyKey = unique('idem-webhook');

      const first = await createWebhook(app, owner, workspace._id, {
        idempotencyKey,
      });

      expect(first.status).toBe(201);

      const second = await createWebhook(app, owner, workspace._id, {
        idempotencyKey,
      });

      expect(second.status).toBe(first.status);

      expect(second.body._id).toBe(first.body._id);

      const count = await mongoConnection
        .collection('webhooks')
        .countDocuments({
          workspaceId: new Types.ObjectId(workspace._id),
        });

      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // PERSISTENCE
  // =========================================================================

  describe('Persistence', () => {
    it('creates an active webhook by default', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id);

      expect(response.status).toBe(201);

      const webhook = await mongoConnection.collection('webhooks').findOne({
        _id: new Types.ObjectId(response.body._id),
      });

      expect(webhook).toBeTruthy();
      expect(webhook?.active).toBe(true);
    });

    it('stores the correct workspace association', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await createWebhook(app, owner, workspace._id);

      const webhook = await mongoConnection.collection('webhooks').findOne({
        _id: new Types.ObjectId(response.body._id),
      });

      expect(webhook).toBeTruthy();

      expect(webhook?.workspaceId.toString()).toBe(workspace._id);
    });

    it('stores all subscribed event types', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const events = [
        'task.created',
        'task.updated',
        'task.deleted',
        'workspace.created',
      ];

      const response = await createWebhook(app, owner, workspace._id, {
        events,
      });

      expect(response.status).toBe(201);

      const webhook = await mongoConnection.collection('webhooks').findOne({
        _id: new Types.ObjectId(response.body._id),
      });

      expect(webhook?.events).toEqual(events);
    });
  });

  // =========================================================================
  // WEBHOOK PROCESSOR
  // =========================================================================

  describe('Webhook Processor', () => {
    let processor: WebhookProcessor;
    let webhookService: WebhookService;
    let processedEventRepository: IProcessedEventRepository;
    let deadLetterService: DeadLetterService;

    beforeEach(() => {
      processor = app.get<WebhookProcessor>(WebhookProcessor);

      webhookService = app.get<WebhookService>(WebhookService);

      processedEventRepository = app.get<IProcessedEventRepository>(
        PROCESSED_EVENT_REPOSITORY,
      );

      deadLetterService = app.get<DeadLetterService>(DeadLetterService);
    });

    it('processes a valid webhook job successfully', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const outboxEventId = new Types.ObjectId().toString();

      const eventType = 'task.created';

      const payload = {
        taskId: new Types.ObjectId().toString(),
        title: 'Integration test task',
      };

      const hasBeenProcessedSpy = jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      const deliverSpy = jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockResolvedValue();

      const markProcessedSpy = jest
        .spyOn(processedEventRepository, 'markProcessed')
        .mockResolvedValue();

      const job = createWebhookJob({
        outboxEventId,
        workspaceId,
        eventType,
        payload,
        correlationId: 'integration-correlation-id',
      });

      await processor.process(job);

      expect(hasBeenProcessedSpy).toHaveBeenCalledWith(outboxEventId);

      expect(deliverSpy).toHaveBeenCalledWith(
        workspaceId,
        outboxEventId,
        eventType,
        payload,
        1,
      );

      expect(markProcessedSpy).toHaveBeenCalledWith(outboxEventId, eventType);
    });

    it('skips a webhook event that has already been processed', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const outboxEventId = new Types.ObjectId().toString();

      const eventType = 'task.updated';

      const payload = {
        taskId: new Types.ObjectId().toString(),
      };

      const hasBeenProcessedSpy = jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(true);

      const deliverSpy = jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockResolvedValue();

      const markProcessedSpy = jest
        .spyOn(processedEventRepository, 'markProcessed')
        .mockResolvedValue();

      const job = createWebhookJob({
        outboxEventId,
        workspaceId,
        eventType,
        payload,
      });

      await processor.process(job);

      expect(hasBeenProcessedSpy).toHaveBeenCalledWith(outboxEventId);

      expect(deliverSpy).not.toHaveBeenCalled();

      expect(markProcessedSpy).not.toHaveBeenCalled();
    });

    it('throws when outboxEventId is missing', async () => {
      const job = createWebhookJob({
        workspaceId: new Types.ObjectId().toString(),
        eventType: 'task.created',
        payload: {
          taskId: 'task-1',
        },
      });

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook job is missing outboxEventId',
      );
    });

    it('throws when workspaceId is missing', async () => {
      const job = createWebhookJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'task.created',
        payload: {
          taskId: 'task-1',
        },
      });

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook job is missing workspaceId',
      );
    });

    it('throws when eventType is missing', async () => {
      const job = createWebhookJob({
        outboxEventId: new Types.ObjectId().toString(),
        workspaceId: new Types.ObjectId().toString(),
        payload: {
          taskId: 'task-1',
        },
      });

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook job is missing eventType',
      );
    });

    it('throws when payload is missing', async () => {
      const job = createWebhookJob({
        outboxEventId: new Types.ObjectId().toString(),
        workspaceId: new Types.ObjectId().toString(),
        eventType: 'task.created',
      });

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook job is missing payload',
      );
    });

    it('passes attemptsMade + 1 to webhook delivery', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const outboxEventId = new Types.ObjectId().toString();

      const eventType = 'task.created';

      const payload = {
        taskId: 'task-attempt-test',
      };

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      const deliverSpy = jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockResolvedValue();

      jest.spyOn(processedEventRepository, 'markProcessed').mockResolvedValue();

      const job = createWebhookJob(
        {
          outboxEventId,
          workspaceId,
          eventType,
          payload,
        },
        {
          attemptsMade: 2,
          attempts: 3,
        },
      );

      await processor.process(job);

      expect(deliverSpy).toHaveBeenCalledWith(
        workspaceId,
        outboxEventId,
        eventType,
        payload,
        3,
      );
    });

    it('marks the event processed only after successful delivery', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const outboxEventId = new Types.ObjectId().toString();

      const eventType = 'task.created';

      const payload = {
        taskId: 'task-success',
      };

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      const callOrder: string[] = [];

      const deliverSpy = jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockImplementation(async () => {
          callOrder.push('deliver');
        });

      const markProcessedSpy = jest
        .spyOn(processedEventRepository, 'markProcessed')
        .mockImplementation(async () => {
          callOrder.push('markProcessed');
        });

      const job = createWebhookJob({
        outboxEventId,
        workspaceId,
        eventType,
        payload,
      });

      await processor.process(job);

      expect(deliverSpy).toHaveBeenCalled();

      expect(markProcessedSpy).toHaveBeenCalled();

      expect(callOrder).toEqual(['deliver', 'markProcessed']);
    });
    it('does not mark the event processed when delivery fails', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const outboxEventId = new Types.ObjectId().toString();

      const eventType = 'task.created';

      const payload = {
        taskId: 'task-failure',
      };

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      const deliveryError = new Error('Webhook delivery failed');

      jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockRejectedValue(deliveryError);

      const markProcessedSpy = jest
        .spyOn(processedEventRepository, 'markProcessed')
        .mockResolvedValue();

      const job = createWebhookJob(
        {
          outboxEventId,
          workspaceId,
          eventType,
          payload,
        },
        {
          attemptsMade: 0,
          attempts: 3,
        },
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook delivery failed',
      );

      expect(markProcessedSpy).not.toHaveBeenCalled();
    });

    it('does not move the job to the DLQ before the final attempt', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const outboxEventId = new Types.ObjectId().toString();

      const eventType = 'task.created';

      const payload = {
        taskId: 'task-retry',
      };

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockRejectedValue(new Error('Temporary webhook failure'));

      const dlqSpy = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue();

      const job = createWebhookJob(
        {
          outboxEventId,
          workspaceId,
          eventType,
          payload,
        },
        {
          attemptsMade: 0,
          attempts: 3,
        },
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Temporary webhook failure',
      );

      expect(dlqSpy).not.toHaveBeenCalled();
    });

    it('moves the job to the DLQ on the final attempt', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const outboxEventId = new Types.ObjectId().toString();

      const eventType = 'task.created';

      const payload = {
        taskId: 'task-dlq',
      };

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      const deliveryError = new Error('Permanent webhook failure');

      jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockRejectedValue(deliveryError);

      const dlqSpy = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue();

      const jobId = unique('webhook-final-job');

      const job = createWebhookJob(
        {
          outboxEventId,
          workspaceId,
          eventType,
          payload,
          correlationId: 'dlq-correlation-id',
        },
        {
          attemptsMade: 2,
          attempts: 3,
          id: jobId,
        },
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Permanent webhook failure',
      );

      expect(dlqSpy).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.WEBHOOK,
        jobId,
        outboxEventId,
        eventType,
        payload,
        error: 'Permanent webhook failure',
        attempts: 3,
        correlationId: 'dlq-correlation-id',
      });
    });

    it('rethrows the original processing error', async () => {
      const workspaceId = new Types.ObjectId().toString();

      const outboxEventId = new Types.ObjectId().toString();

      const originalError = new Error('Original webhook error');

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockRejectedValue(originalError);

      jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue();

      const job = createWebhookJob(
        {
          outboxEventId,
          workspaceId,
          eventType: 'task.created',
          payload: {
            taskId: 'task-error',
          },
        },
        {
          attemptsMade: 0,
          attempts: 1,
        },
      );

      await expect(processor.process(job)).rejects.toBe(originalError);
    });
  });
});
