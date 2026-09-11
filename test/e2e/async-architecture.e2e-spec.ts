import {
  INestApplication,
  Injectable,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';

import { clearDatabase, closeDatabase } from '../integration/setup/database';

import { clearRedis, closeRedis } from '../integration/setup/redis';

import { QUEUE_NAMES } from '../../src/infrastructure/queues/queue.constants';
import { OutboxEventStatus } from '../../src/outbox/domain/enums/outbox-event-status.enum';

/**
 * ===========================================================================
 * Mail test double
 * ===========================================================================
 *
 * The async E2E suite must verify that the real EmailProcessor eventually
 * reaches the mail layer.
 *
 * We therefore replace only the external mail delivery implementation.
 *
 * The application, MongoDB, Redis, BullMQ, OutboxDispatcherService and
 * EmailProcessor remain real.
 */
@Injectable()
class MailTestDouble {
  public sentInvitations: {
    to: string;
    workspaceName: string;
    token: string;
    expiresAt: Date;
  }[] = [];

  public sentVerificationEmails: {
    to: string;
    token: string;
    expiresAt: Date;
  }[] = [];

  public sentPasswordResetEmails: {
    to: string;
    token: string;
    expiresAt: Date;
  }[] = [];

  public sentReminderEmails: {
    to: string;
    taskTitle: string;
    dueDate: Date;
    priority: string;
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

  async sendVerificationEmail(
    to: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sentVerificationEmails.push({
      to,
      token,
      expiresAt,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sentPasswordResetEmails.push({
      to,
      token,
      expiresAt,
    });
  }

  async sendReminderEmail(
    to: string,
    taskTitle: string,
    dueDate: Date,
    priority: string,
  ): Promise<void> {
    this.sentReminderEmails.push({
      to,
      taskTitle,
      dueDate,
      priority,
    });
  }

  reset(): void {
    this.sentInvitations = [];
    this.sentVerificationEmails = [];
    this.sentPasswordResetEmails = [];
    this.sentReminderEmails = [];
  }
}

/**
 * ===========================================================================
 * Test application
 * ===========================================================================
 */
async function createAsyncArchitectureE2ETestApp(): Promise<{
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
 * Async polling helper
 * ===========================================================================
 *
 * BullMQ + cron are asynchronous.
 *
 * The OutboxDispatcherService runs every five seconds, therefore E2E tests
 * must poll rather than use arbitrary short sleeps.
 */
async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 30000,
  interval = 250,
): Promise<void> {
  const startedAt = Date.now();

  let lastError: unknown;

  while (Date.now() - startedAt < timeout) {
    try {
      if (await condition()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`Async condition was not satisfied within ${timeout}ms`);
}

/**
 * ===========================================================================
 * Register user
 * ===========================================================================
 *
 * We intentionally DO NOT verify the user here.
 *
 * Registration itself creates the asynchronous verification-email flow:
 *
 * HTTP
 *   ↓
 * Auth application
 *   ↓
 * EmailDelivery + OutboxEvent
 *   ↓
 * OutboxDispatcher
 *   ↓
 * email queue
 *   ↓
 * EmailProcessor
 *   ↓
 * MailService test double
 */
async function registerUser(
  app: INestApplication,
  email = `${unique('async-user')}@test.com`,
): Promise<{
  email: string;
  password: string;
}> {
  const password = 'Password123!';

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', unique('idem-register'))
      .send({
        email,
        password,
      }),
  );

  if (response.status >= 400) {
    throw new Error(
      `Registration failed (${response.status}): ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  return {
    email,
    password,
  };
}

/**
 * ===========================================================================
 * Async Architecture E2E
 * ===========================================================================
 */
describe('Async Architecture E2E', () => {
  let app: INestApplication;
  let mailDouble: MailTestDouble;
  let mongoConnection: Connection;

  let emailQueue: Queue;
  let webhookQueue: Queue;
  let dlqQueue: Queue;

  beforeAll(async () => {
    const created = await createAsyncArchitectureE2ETestApp();

    app = created.app;
    mailDouble = created.mailDouble;

    mongoConnection = app.get<Connection>(getConnectionToken());

    emailQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.EMAIL));

    webhookQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.WEBHOOK));

    dlqQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.DLQ));
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
  // HTTP → OUTBOX → BULLMQ → PROCESSOR → SIDE EFFECT
  // =======================================================================

  describe('HTTP to asynchronous worker flow', () => {
    it('processes a registration email asynchronously from HTTP request through Outbox and BullMQ to the mail service', async () => {
      const email = `${unique('async-email')}@test.com`;

      const password = 'Password123!';

      const correlationId = unique('async-correlation');

      const response = await withIp(
        request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .set('Idempotency-Key', unique('idem-async-register'))
          .set('X-Request-Id', correlationId)
          .send({
            email,
            password,
          }),
      );

      expect(response.status).toBe(201);

      /**
       * Registration must synchronously create the outbox event.
       */
      let outboxEvent: any = null;

      await waitFor(async () => {
        outboxEvent = await mongoConnection.collection('outboxevents').findOne({
          eventType: 'EMAIL_REQUESTED',
          'payload.to': email,
        });

        return !!outboxEvent;
      }, 10000);

      expect(outboxEvent).toBeTruthy();

      expect(outboxEvent.eventType).toBe('EMAIL_REQUESTED');

      expect(outboxEvent.status).toBeDefined();

      expect(outboxEvent.payload.emailType).toBe('EMAIL_VERIFICATION');

      /**
       * Correlation ID must travel from the HTTP request
       * into the Outbox event.
       */
      expect(outboxEvent.correlationId).toBe(correlationId);

      /**
       * The dispatcher runs every five seconds.
       *
       * Wait until the outbox reaches COMPLETED.
       */
      await waitFor(async () => {
        const current = await mongoConnection
          .collection('outboxevents')
          .findOne({
            _id: outboxEvent._id,
          });

        return current?.status === OutboxEventStatus.COMPLETED;
      }, 30000);

      const completedOutbox = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: outboxEvent._id,
        });

      expect(completedOutbox).toBeTruthy();

      expect(completedOutbox?.status).toBe(OutboxEventStatus.COMPLETED);

      expect(completedOutbox?.processedAt).toBeDefined();

      /**
       * The dispatcher must have placed the event into
       * the real email queue.
       */
      await waitFor(async () => {
        const completedJobs = await emailQueue.getCompleted();

        return completedJobs.some(
          (job) => job.data?.outboxEventId === outboxEvent._id.toString(),
        );
      }, 30000);

      /**
       * The real EmailProcessor must eventually invoke
       * the MailService test double.
       */
      await waitFor(
        async () =>
          mailDouble.sentVerificationEmails.some((mail) => mail.to === email),
        30000,
      );

      const sentEmail = mailDouble.sentVerificationEmails.find(
        (mail) => mail.to === email,
      );

      expect(sentEmail).toBeDefined();

      expect(sentEmail?.to).toBe(email);

      expect(sentEmail?.token).toBeTruthy();

      expect(sentEmail?.expiresAt).toBeInstanceOf(Date);

      /**
       * Verify the EmailDelivery side of the async flow.
       */
      const delivery = await mongoConnection
        .collection('emaildeliveries')
        .findOne({
          outboxEventId: outboxEvent._id,
        });

      expect(delivery).toBeTruthy();

      expect(delivery?.status).toBe('SENT');

      expect(delivery?.sentAt).toBeDefined();
    }, 60000);
  });

  // =======================================================================
  // OUTBOX → CORRECT QUEUE
  // =======================================================================

  describe('Outbox dispatcher routing', () => {
    it('dispatches EMAIL_REQUESTED to the email queue with the expected job data', async () => {
      const email = `${unique('routing-email')}@test.com`;

      await registerUser(app, email);

      let outboxEvent: any = null;

      await waitFor(async () => {
        outboxEvent = await mongoConnection.collection('outboxevents').findOne({
          eventType: 'EMAIL_REQUESTED',
          'payload.to': email,
        });

        return !!outboxEvent;
      }, 10000);

      expect(outboxEvent).toBeTruthy();

      /**
       * Wait for the dispatcher to mark it completed.
       */
      await waitFor(async () => {
        const current = await mongoConnection
          .collection('outboxevents')
          .findOne({
            _id: outboxEvent._id,
          });

        return current?.status === OutboxEventStatus.COMPLETED;
      }, 30000);

      /**
       * Verify that the email queue actually received
       * the outbox event.
       */
      await waitFor(async () => {
        const jobs = await emailQueue.getCompleted();

        return jobs.some((job) => job.id === outboxEvent._id.toString());
      }, 30000);

      const jobs = await emailQueue.getCompleted();

      const job = jobs.find((item) => item.id === outboxEvent._id.toString());

      expect(job).toBeDefined();

      expect(job?.data.outboxEventId).toBe(outboxEvent._id.toString());

      expect(job?.data.eventType).toBe('EMAIL_REQUESTED');

      expect(job?.data.payload).toEqual(
        expect.objectContaining({
          to: email,
        }),
      );
    }, 60000);
  });

  // =======================================================================
  // EMAIL DELIVERY STATE
  // =======================================================================

  describe('Asynchronous email delivery state', () => {
    it('transitions an email delivery from pending processing to SENT after the worker succeeds', async () => {
      const email = `${unique('delivery-email')}@test.com`;

      await registerUser(app, email);

      let outboxEvent: any = null;

      await waitFor(async () => {
        outboxEvent = await mongoConnection.collection('outboxevents').findOne({
          eventType: 'EMAIL_REQUESTED',
          'payload.to': email,
        });

        return !!outboxEvent;
      }, 10000);

      const deliveryBefore = await mongoConnection
        .collection('emaildeliveries')
        .findOne({
          outboxEventId: outboxEvent._id,
        });

      expect(deliveryBefore).toBeTruthy();

      /**
       * Depending on the exact timing of the dispatcher and worker,
       * the delivery may already have advanced beyond its initial state.
       *
       * The important E2E guarantee is that the asynchronous pipeline
       * ultimately transitions the delivery to SENT.
       */
      expect(['QUEUED', 'PENDING', 'SENDING', 'SENT']).toContain(
        deliveryBefore?.status,
      );

      await waitFor(async () => {
        const delivery = await mongoConnection
          .collection('emaildeliveries')
          .findOne({
            outboxEventId: outboxEvent._id,
          });

        return delivery?.status === 'SENT';
      }, 30000);

      const finalDelivery = await mongoConnection
        .collection('emaildeliveries')
        .findOne({
          outboxEventId: outboxEvent._id,
        });

      expect(finalDelivery?.status).toBe('SENT');

      expect(finalDelivery?.sentAt).toBeDefined();

      expect(finalDelivery?.attempts).toBeGreaterThanOrEqual(1);

      expect(
        mailDouble.sentVerificationEmails.some((mail) => mail.to === email),
      ).toBe(true);
    }, 60000);
  });

  // =======================================================================
  // CORRELATION ID PROPAGATION
  // =======================================================================

  describe('Correlation ID propagation', () => {
    it('preserves the request correlation ID on the outbox event and BullMQ job', async () => {
      const email = `${unique('correlation-email')}@test.com`;

      const correlationId = unique('correlation');

      const response = await withIp(
        request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .set('Idempotency-Key', unique('idem-correlation'))
          .set('X-Request-Id', correlationId)
          .send({
            email,
            password: 'Password123!',
          }),
      );

      expect(response.status).toBe(201);

      let outboxEvent: any = null;

      await waitFor(async () => {
        outboxEvent = await mongoConnection.collection('outboxevents').findOne({
          eventType: 'EMAIL_REQUESTED',
          'payload.to': email,
        });

        return !!outboxEvent;
      }, 10000);

      expect(outboxEvent.correlationId).toBe(correlationId);

      /**
       * Wait for dispatcher.
       */
      await waitFor(async () => {
        const current = await mongoConnection
          .collection('outboxevents')
          .findOne({
            _id: outboxEvent._id,
          });

        return current?.status === OutboxEventStatus.COMPLETED;
      }, 30000);

      /**
       * Verify the correlation ID was copied into
       * the BullMQ job data by OutboxDispatcherService.
       */
      await waitFor(async () => {
        const completedJobs = await emailQueue.getCompleted();

        return completedJobs.some(
          (job) =>
            job.data?.outboxEventId === outboxEvent._id.toString() &&
            job.data?.correlationId === correlationId,
        );
      }, 30000);

      const completedJobs = await emailQueue.getCompleted();

      const job = completedJobs.find(
        (item) => item.data?.outboxEventId === outboxEvent._id.toString(),
      );

      expect(job).toBeDefined();

      expect(job?.data.correlationId).toBe(correlationId);
    }, 60000);
  });

  // =======================================================================
  // BULLMQ RETRY / DEAD LETTER QUEUE
  // =======================================================================

  describe('Retry and dead-letter queue', () => {
    it('moves a permanently invalid webhook job to the dead-letter queue', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const job = await webhookQueue.add(
        'TASK_CREATED',
        {
          /**
           * Deliberately omit workspaceId.
           *
           * WebhookProcessor validates this field and throws.
           */
          outboxEventId,
          eventType: 'TASK_CREATED',
          payload: {
            taskId: new Types.ObjectId().toString(),
          },
          correlationId: unique('dlq-correlation'),
        },
        {
          /**
           * Override the normal five-attempt queue
           * configuration for this E2E test.
           *
           * We are testing the actual processor's
           * final-attempt/DLQ behavior without making
           * the test wait through five exponential retries.
           */
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        },
      );

      expect(job.id).toBeDefined();

      /**
       * Wait for BullMQ to execute the real
       * WebhookProcessor.
       */
      await waitFor(async () => {
        const failedJobs = await webhookQueue.getFailed();

        return failedJobs.some((failedJob) => failedJob.id === job.id);
      }, 15000);

      const failedJobs = await webhookQueue.getFailed();

      const failedJob = failedJobs.find((failed) => failed.id === job.id);

      expect(failedJob).toBeDefined();

      /**
       * The WebhookProcessor should have sent the
       * failed job to the DLQ.
       */
      await waitFor(async () => {
        const waiting = await dlqQueue.getWaiting();

        const delayed = await dlqQueue.getDelayed();

        const active = await dlqQueue.getActive();

        const completed = await dlqQueue.getCompleted();

        const allJobs = [...waiting, ...delayed, ...active, ...completed];

        return allJobs.some(
          (dlqJob) => dlqJob.data?.outboxEventId === outboxEventId,
        );
      }, 15000);

      const waiting = await dlqQueue.getWaiting();

      const delayed = await dlqQueue.getDelayed();

      const active = await dlqQueue.getActive();

      const completed = await dlqQueue.getCompleted();

      const dlqJobs = [...waiting, ...delayed, ...active, ...completed];

      const dlqJob = dlqJobs.find(
        (item) => item.data?.outboxEventId === outboxEventId,
      );

      expect(dlqJob).toBeDefined();

      expect(dlqJob?.data.queueName).toBe(QUEUE_NAMES.WEBHOOK);

      expect(dlqJob?.data.outboxEventId).toBe(outboxEventId);

      expect(dlqJob?.data.eventType).toBe('TASK_CREATED');

      expect(dlqJob?.data.error).toBe('Webhook job is missing workspaceId');

      expect(dlqJob?.data.attempts).toBe(1);
    }, 30000);
  });

  // =======================================================================
  // QUEUE METRICS
  // =======================================================================

  describe('Queue observability', () => {
    it('exposes BullMQ queue metrics through the application metrics endpoint', async () => {
      /**
       * QueueMetricsService updates metrics every ten seconds,
       * but it also performs an immediate update during module init.
       *
       * Give it a little time to finish its asynchronous initial
       * update before querying /metrics.
       */
      await waitFor(async () => {
        const response = await withIp(
          request(app.getHttpServer()).get('/api/v1/metrics'),
        );

        return response.status === 200;
      }, 10000);

      const response = await withIp(
        request(app.getHttpServer()).get('/api/v1/metrics'),
      );

      expect(response.status).toBe(200);

      expect(response.text).toContain('queue_waiting_jobs');

      expect(response.text).toContain('queue_active_jobs');

      expect(response.text).toContain('queue_delayed_jobs');

      expect(response.text).toContain('queue_failed_jobs');

      expect(response.text).toContain(QUEUE_NAMES.EMAIL);

      expect(response.text).toContain(QUEUE_NAMES.WEBHOOK);

      expect(response.text).toContain(QUEUE_NAMES.REMINDER);

      expect(response.text).toContain(QUEUE_NAMES.EXPORT);

      expect(response.text).toContain(QUEUE_NAMES.DLQ);
    }, 30000);
  });
});
