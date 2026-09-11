import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { createIntegrationApp } from '../setup/test-app.factory';
import { clearDatabase } from '../setup/database';
import { clearRedis } from '../setup/redis';

import { OutboxDispatcherService } from '../../../src/outbox/application/outbox-dispatcher.service';
import { OutboxService } from '../../../src/outbox/application/outbox.service';

import { OUTBOX_REPOSITORY } from '../../../src/outbox/domain/constants/repository.tokens';

import type { IOutboxRepository } from '../../../src/outbox/domain/repositories/outbox.repository.interface';

import { OutboxEventStatus } from '../../../src/outbox/domain/enums/outbox-event-status.enum';

import { QUEUE_NAMES } from '../../../src/infrastructure/queues/queue.constants';

import { RequestContextService } from '../../../src/common/http/request-context.service';
jest.setTimeout(30000);

describe('Outbox Module (integration)', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  let outboxRepository: IOutboxRepository;
  let outboxService: OutboxService;
  let dispatcher: OutboxDispatcherService;
  let requestContextService: RequestContextService;

  let emailQueue: Queue;
  let reminderQueue: Queue;
  let webhookQueue: Queue;
  let exportQueue: Queue;

  beforeAll(async () => {
    app = await createIntegrationApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    outboxRepository = app.get<IOutboxRepository>(OUTBOX_REPOSITORY);

    outboxService = app.get<OutboxService>(OutboxService);

    dispatcher = app.get<OutboxDispatcherService>(OutboxDispatcherService);

    requestContextService = app.get<RequestContextService>(
      RequestContextService,
    );

    emailQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.EMAIL));

    reminderQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.REMINDER));

    webhookQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.WEBHOOK));

    exportQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.EXPORT));
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();

    /*
     * The queues are real BullMQ queues backed by the real Redis instance.
     *
     * Obliterate removes jobs from previous tests so that queue assertions
     * remain deterministic.
     */
    await emailQueue.obliterate({
      force: true,
    });

    await reminderQueue.obliterate({
      force: true,
    });

    await webhookQueue.obliterate({
      force: true,
    });

    await exportQueue.obliterate({
      force: true,
    });
  }, 30000);

  afterAll(async () => {
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // =========================================================================
  // HELPERS
  // =========================================================================

  function createEventData(
    overrides: Partial<{
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      workspaceId: string;
      payload: Record<string, unknown>;
      status: OutboxEventStatus;
      availableAt: Date;
    }> = {},
  ) {
    return {
      eventType: overrides.eventType ?? 'TASK_CREATED',

      aggregateType: overrides.aggregateType ?? 'Task',

      aggregateId: overrides.aggregateId ?? new Types.ObjectId().toString(),

      workspaceId: overrides.workspaceId ?? new Types.ObjectId().toString(),

      payload: overrides.payload ?? {
        taskId: new Types.ObjectId().toString(),
        title: 'Integration test task',
      },

      ...(overrides.status !== undefined
        ? {
            status: overrides.status,
          }
        : {}),

      ...(overrides.availableAt !== undefined
        ? {
            availableAt: overrides.availableAt,
          }
        : {}),
    };
  }

  /**
   * Creates an outbox event through OutboxService.
   *
   * Note:
   * OutboxService obtains correlationId from RequestContextService,
   * so this helper intentionally does not pass correlationId directly.
   */
  async function createEvent(
    overrides: Parameters<typeof createEventData>[0] = {},
  ) {
    return outboxService.create(createEventData(overrides));
  }

  /**
   * Creates an outbox event inside an AsyncLocalStorage request context.
   *
   * This mirrors how the real application obtains the request/correlation ID.
   */
  async function createEventWithCorrelationId(
    requestId: string,
    overrides: Parameters<typeof createEventData>[0] = {},
  ) {
    return requestContextService.run(
      {
        requestId,
      },
      () => outboxService.create(createEventData(overrides)),
    );
  }

  /**
   * Creates an outbox event directly through the repository.
   *
   * This is used when testing repository behavior that OutboxService.create()
   * intentionally does not expose, such as status and availableAt.
   */
  async function createRepositoryEvent(
    overrides: Partial<{
      eventType: string;
      aggregateType: string;
      aggregateId: Types.ObjectId;
      workspaceId: Types.ObjectId;
      payload: Record<string, unknown>;
      status: OutboxEventStatus;
      availableAt: Date;
      correlationId: string;
    }> = {},
  ) {
    return outboxRepository.create({
      eventType: overrides.eventType ?? 'TASK_CREATED',

      aggregateType: overrides.aggregateType ?? 'Task',

      aggregateId: overrides.aggregateId ?? new Types.ObjectId(),

      workspaceId: overrides.workspaceId ?? new Types.ObjectId(),

      payload: overrides.payload ?? {
        taskId: new Types.ObjectId().toString(),
        title: 'Integration test task',
      },

      ...(overrides.status !== undefined
        ? {
            status: overrides.status,
          }
        : {}),

      ...(overrides.availableAt !== undefined
        ? {
            availableAt: overrides.availableAt,
          }
        : {}),

      ...(overrides.correlationId !== undefined
        ? {
            correlationId: overrides.correlationId,
          }
        : {}),
    });
  }

  // =========================================================================
  // OUTBOX CREATION / PERSISTENCE
  // =========================================================================

  describe('OutboxService.create', () => {
    it('creates and persists a PENDING outbox event in MongoDB', async () => {
      const aggregateId = new Types.ObjectId().toString();

      const workspaceId = new Types.ObjectId().toString();

      const payload = {
        taskId: aggregateId,
        title: 'Create task event',
      };

      const event = await outboxService.create({
        eventType: 'TASK_CREATED',

        aggregateType: 'Task',

        aggregateId,

        workspaceId,

        payload,
      });

      expect(event).toBeTruthy();

      expect(event._id).toBeDefined();

      expect(event.eventType).toBe('TASK_CREATED');

      expect(event.aggregateType).toBe('Task');

      expect(event.aggregateId.toString()).toBe(aggregateId);

      expect(event.workspaceId?.toString()).toBe(workspaceId);

      expect(event.payload).toEqual(payload);

      expect(event.status).toBe(OutboxEventStatus.PENDING);

      expect(event.attempts).toBe(0);

      const persisted = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: event._id,
        });

      expect(persisted).toBeTruthy();

      expect(persisted?.status).toBe(OutboxEventStatus.PENDING);

      expect(persisted?.aggregateId.toString()).toBe(aggregateId);
    });

    it('stores the request correlation ID on the outbox event', async () => {
      const event = await createEventWithCorrelationId(
        'outbox-test-correlation-id',
      );

      expect(event.correlationId).toBe('outbox-test-correlation-id');

      const persisted = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: event._id,
        });

      expect(persisted?.correlationId).toBe('outbox-test-correlation-id');
    });
  });

  // =========================================================================
  // FIND PENDING
  // =========================================================================

  describe('findPending', () => {
    it('returns eligible PENDING events', async () => {
      const event = await createEvent({
        status: OutboxEventStatus.PENDING,
      });

      const events = await outboxRepository.findPending(50, new Date());

      expect(events).toHaveLength(1);

      expect(events[0]._id.toString()).toBe(event._id.toString());
    });

    it('returns eligible FAILED events', async () => {
      const event = await createRepositoryEvent({
        status: OutboxEventStatus.FAILED,

        availableAt: new Date(Date.now() - 1000),
      });

      const events = await outboxRepository.findPending(50, new Date());

      expect(events).toHaveLength(1);

      expect(events[0]._id.toString()).toBe(event._id.toString());
    });

    it('does not return future FAILED events', async () => {
      await createRepositoryEvent({
        status: OutboxEventStatus.FAILED,

        availableAt: new Date(Date.now() + 60_000),
      });

      const events = await outboxRepository.findPending(50, new Date());

      expect(events).toHaveLength(0);
    });

    it('does not return PROCESSING or COMPLETED events', async () => {
      await createRepositoryEvent({
        status: OutboxEventStatus.PROCESSING,
      });

      await createRepositoryEvent({
        status: OutboxEventStatus.COMPLETED,
      });

      const events = await outboxRepository.findPending(50, new Date());

      expect(events).toHaveLength(0);
    });

    it('respects the limit and returns oldest events first', async () => {
      const first = await createEvent({
        payload: {
          order: 1,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await createEvent({
        payload: {
          order: 2,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createEvent({
        payload: {
          order: 3,
        },
      });

      const events = await outboxRepository.findPending(2, new Date());

      expect(events).toHaveLength(2);

      expect(events[0]._id.toString()).toBe(first._id.toString());

      expect(events[1]._id.toString()).toBe(second._id.toString());
    });
  });

  // =========================================================================
  // STATE TRANSITIONS
  // =========================================================================

  describe('Outbox state transitions', () => {
    it('marks a PENDING event as PROCESSING and increments attempts', async () => {
      const event = await createEvent();

      const processing = await outboxRepository.markProcessing(
        event._id.toString(),
      );

      expect(processing).toBeTruthy();

      expect(processing?.status).toBe(OutboxEventStatus.PROCESSING);

      expect(processing?.attempts).toBe(1);

      const persisted = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: event._id,
        });

      expect(persisted?.status).toBe(OutboxEventStatus.PROCESSING);

      expect(persisted?.attempts).toBe(1);
    });

    it('cannot claim an event that is already PROCESSING', async () => {
      const event = await createEvent();

      const first = await outboxRepository.markProcessing(event._id.toString());

      expect(first).toBeTruthy();

      const second = await outboxRepository.markProcessing(
        event._id.toString(),
      );

      expect(second).toBeNull();
    });

    it('marks a PROCESSING event as COMPLETED and sets processedAt', async () => {
      const event = await createEvent();

      await outboxRepository.markProcessing(event._id.toString());

      const completed = await outboxRepository.markCompleted(
        event._id.toString(),
      );

      expect(completed).toBeTruthy();

      expect(completed?.status).toBe(OutboxEventStatus.COMPLETED);

      expect(completed?.processedAt).toBeInstanceOf(Date);
    });

    it('marks a failed event with an error and retry availability', async () => {
      const event = await createEvent();

      await outboxRepository.markProcessing(event._id.toString());

      const availableAt = new Date(Date.now() + 5000);

      const failed = await outboxRepository.markFailed(
        event._id.toString(),
        'Temporary queue failure',
        availableAt,
      );

      expect(failed).toBeTruthy();

      expect(failed?.status).toBe(OutboxEventStatus.FAILED);

      expect(failed?.lastError).toBe('Temporary queue failure');

      expect(failed?.availableAt?.getTime()).toBe(availableAt.getTime());
    });

    it('removes retry availability after the maximum number of attempts', async () => {
      const event = await createEvent();

      await mongoConnection.collection('outboxevents').updateOne(
        {
          _id: event._id,
        },
        {
          $set: {
            attempts: 5,

            status: OutboxEventStatus.PROCESSING,

            availableAt: new Date(Date.now() + 5000),
          },
        },
      );

      const failed = await outboxRepository.markFailed(
        event._id.toString(),
        'Permanent failure',
        new Date(Date.now() + 5000),
      );

      expect(failed).toBeTruthy();

      expect(failed?.status).toBe(OutboxEventStatus.FAILED);

      expect(failed?.lastError).toBe('Permanent failure');

      expect(failed?.availableAt).toBeUndefined();
    });
  });

  // =========================================================================
  // DISPATCHER
  // =========================================================================

  describe('OutboxDispatcherService', () => {
    it('dispatches an EMAIL_REQUESTED event to the email queue and completes the outbox event', async () => {
      const event = await createEventWithCorrelationId(
        'email-dispatch-correlation-id',
        {
          eventType: 'EMAIL_REQUESTED',
        },
      );

      await dispatcher.dispatchPending();

      const persisted = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: event._id,
        });

      expect(persisted).toBeTruthy();

      expect(persisted?.status).toBe(OutboxEventStatus.COMPLETED);

      expect(persisted?.processedAt).toBeInstanceOf(Date);

      const jobs = await emailQueue.getJobs([
        'waiting',
        'active',
        'delayed',
        'completed',
      ]);

      const job = jobs.find(
        (candidate) => candidate.id === event._id.toString(),
      );

      expect(job).toBeDefined();

      expect(job?.name).toBe('EMAIL_REQUESTED');

      expect(job?.data).toMatchObject({
        outboxEventId: event._id.toString(),

        eventType: 'EMAIL_REQUESTED',

        aggregateType: event.aggregateType,

        aggregateId: event.aggregateId.toString(),

        workspaceId: event.workspaceId?.toString(),

        correlationId: 'email-dispatch-correlation-id',

        payload: event.payload,
      });

      expect(job?.opts.attempts).toBe(3);

      expect(job?.opts.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      });
    });

    it('dispatches REMINDER_DUE events to the reminder queue', async () => {
      const event = await createEventWithCorrelationId(
        'reminder-dispatch-correlation-id',
        {
          eventType: 'REMINDER_DUE',
        },
      );

      await dispatcher.dispatchPending();

      const persisted = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: event._id,
        });

      expect(persisted?.status).toBe(OutboxEventStatus.COMPLETED);

      const jobs = await reminderQueue.getJobs([
        'waiting',
        'active',
        'delayed',
        'completed',
      ]);

      expect(jobs.some((job) => job.id === event._id.toString())).toBe(true);
    });

    it('dispatches task events to the webhook queue', async () => {
      const event = await createEventWithCorrelationId(
        'webhook-dispatch-correlation-id',
        {
          eventType: 'TASK_CREATED',
        },
      );

      await dispatcher.dispatchPending();

      const persisted = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: event._id,
        });

      expect(persisted?.status).toBe(OutboxEventStatus.COMPLETED);

      const jobs = await webhookQueue.getJobs([
        'waiting',
        'active',
        'delayed',
        'completed',
      ]);

      expect(jobs.some((job) => job.id === event._id.toString())).toBe(true);
    });

    it('dispatches EXPORT_REQUESTED events to the export queue', async () => {
      const event = await createEventWithCorrelationId(
        'export-dispatch-correlation-id',
        {
          eventType: 'EXPORT_REQUESTED',
        },
      );

      await dispatcher.dispatchPending();

      const persisted = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: event._id,
        });

      expect(persisted?.status).toBe(OutboxEventStatus.COMPLETED);

      const jobs = await exportQueue.getJobs([
        'waiting',
        'active',
        'delayed',
        'completed',
      ]);

      expect(jobs.some((job) => job.id === event._id.toString())).toBe(true);
    });

    it('marks an event FAILED when no queue is configured for its event type', async () => {
      const event = await createEventWithCorrelationId(
        'unknown-event-correlation-id',
        {
          eventType: 'UNKNOWN_EVENT',
        },
      );

      await dispatcher.dispatchPending();

      const persisted = await mongoConnection
        .collection('outboxevents')
        .findOne({
          _id: event._id,
        });

      expect(persisted).toBeTruthy();

      expect(persisted?.status).toBe(OutboxEventStatus.FAILED);

      expect(persisted?.lastError).toContain(
        'No queue configured for event type: UNKNOWN_EVENT',
      );

      expect(persisted?.availableAt).toBeInstanceOf(Date);
    });
  });
});
