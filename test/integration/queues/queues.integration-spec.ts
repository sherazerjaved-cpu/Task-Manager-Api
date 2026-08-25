import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { Connection, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { WebhookService } from '../../../src/webhook/application/webhook.service';
import { createIntegrationApp } from '../setup/test-app.factory';
import { clearDatabase, closeDatabase } from '../setup/database';
import { clearRedis, closeRedis } from '../setup/redis';

import { QUEUE_NAMES } from '../../../src/infrastructure/queues/queue.constants';

import { EmailProcessor } from '../../../src/infrastructure/processors/email.processor';
import { ReminderProcessor } from '../../../src/infrastructure/processors/reminder.processor';
import { WebhookProcessor } from '../../../src/infrastructure/processors/webhook.processor';
import { ExportProcessor } from '../../../src/infrastructure/processors/export.processor';
import { DeadLetterProcessor } from '../../../src/infrastructure/processors/dead-letter.processor';

import { DeadLetterService } from '../../../src/infrastructure/queues/dead-letter.service';
import { QueueMetricsService } from '../../../src/infrastructure/queues/queue-metrics.service';

import { MailService } from '../../../src/mail/mail.service';

import { PROCESSED_EVENT_REPOSITORY } from '../../../src/outbox/domain/constants/repository.tokens';

import type { IProcessedEventRepository } from '../../../src/outbox/domain/repositories/processed-event.repository.interface';

import { EMAIL_DELIVERY_REPOSITORY } from '../../../src/mail/domain/constants/repository.tokens';

import type { IEmailDeliveryRepository } from '../../../src/mail/domain/repositories/email-delivery.repository.interface';

import { EmailDeliveryStatus } from '../../../src/mail/domain/enums/email-delivery-status.enum';

import { EXPORT_REPOSITORY } from '../../../src/export/domain/constants/repository.tokens';

import type { IExportRepository } from '../../../src/export/domain/repositories/export.repository.interface';

import { ExportService } from '../../../src/export/application/export.service';

import { MetricsService } from '../../../src/metrics/application/metrics.service';

jest.setTimeout(30000);

describe('Queues Module (integration)', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  let emailQueue: Queue;
  let reminderQueue: Queue;
  let webhookQueue: Queue;
  let exportQueue: Queue;
  let dlqQueue: Queue;

  let emailProcessor: EmailProcessor;
  let reminderProcessor: ReminderProcessor;
  let webhookProcessor: WebhookProcessor;
  let exportProcessor: ExportProcessor;
  let deadLetterProcessor: DeadLetterProcessor;

  let deadLetterService: DeadLetterService;
  let queueMetricsService: QueueMetricsService;

  let mailService: MailService;
  let processedEventRepository: IProcessedEventRepository;
  let emailDeliveryRepository: IEmailDeliveryRepository;
  let exportRepository: IExportRepository;
  let exportService: ExportService;
  let metricsService: MetricsService;

  beforeAll(async () => {
    app = await createIntegrationApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    emailQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.EMAIL));

    reminderQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.REMINDER));

    webhookQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.WEBHOOK));

    exportQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.EXPORT));

    dlqQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.DLQ));

    emailProcessor = app.get<EmailProcessor>(EmailProcessor);

    reminderProcessor = app.get<ReminderProcessor>(ReminderProcessor);

    webhookProcessor = app.get<WebhookProcessor>(WebhookProcessor);

    exportProcessor = app.get<ExportProcessor>(ExportProcessor);

    deadLetterProcessor = app.get<DeadLetterProcessor>(DeadLetterProcessor);

    deadLetterService = app.get<DeadLetterService>(DeadLetterService);

    queueMetricsService = app.get<QueueMetricsService>(QueueMetricsService);

    mailService = app.get<MailService>(MailService);

    processedEventRepository = app.get<IProcessedEventRepository>(
      PROCESSED_EVENT_REPOSITORY,
    );

    emailDeliveryRepository = app.get<IEmailDeliveryRepository>(
      EMAIL_DELIVERY_REPOSITORY,
    );

    exportRepository = app.get<IExportRepository>(EXPORT_REPOSITORY);

    exportService = app.get<ExportService>(ExportService);

    metricsService = app.get<MetricsService>(MetricsService);
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();

    /*
     * Queues are real BullMQ queues backed by Redis.
     *
     * Obliterate makes every test deterministic by removing jobs
     * left behind by previous tests.
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

    await dlqQueue.obliterate({
      force: true,
    });

    jest.restoreAllMocks();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (mongoConnection) {
      await closeDatabase(mongoConnection);
    }

    await closeRedis();
  }, 30000);

  // =========================================================================
  // HELPERS
  // =========================================================================

  function createJob(
    data: Record<string, unknown>,
    options: {
      id?: string;
      attemptsMade?: number;
      attempts?: number;
    } = {},
  ): any {
    return {
      id: options.id ?? `integration-job-${new Types.ObjectId().toString()}`,

      data,

      attemptsMade: options.attemptsMade ?? 0,

      opts: {
        attempts: options.attempts ?? 1,
      },
    };
  }

  async function getJobs(queue: Queue): Promise<any[]> {
    return queue.getJobs([
      'waiting',
      'active',
      'delayed',
      'completed',
      'failed',
    ]);
  }

  function fakeEmailDelivery() {
    return {
      _id: new Types.ObjectId(),
      outboxEventId: new Types.ObjectId(),
      status: EmailDeliveryStatus.QUEUED,
      attempts: 0,
    } as any;
  }

  // =========================================================================
  // QUEUE REGISTRATION
  // =========================================================================

  describe('Queue registration', () => {
    it('registers the email queue', async () => {
      expect(emailQueue).toBeDefined();

      expect(emailQueue.name).toBe(QUEUE_NAMES.EMAIL);

      expect(await emailQueue.getJobCounts()).toBeDefined();
    });

    it('registers the reminder queue', async () => {
      expect(reminderQueue).toBeDefined();

      expect(reminderQueue.name).toBe(QUEUE_NAMES.REMINDER);

      expect(await reminderQueue.getJobCounts()).toBeDefined();
    });

    it('registers the webhook queue', async () => {
      expect(webhookQueue).toBeDefined();

      expect(webhookQueue.name).toBe(QUEUE_NAMES.WEBHOOK);

      expect(await webhookQueue.getJobCounts()).toBeDefined();
    });

    it('registers the export queue', async () => {
      expect(exportQueue).toBeDefined();

      expect(exportQueue.name).toBe(QUEUE_NAMES.EXPORT);

      expect(await exportQueue.getJobCounts()).toBeDefined();
    });

    it('registers the dead-letter queue', async () => {
      expect(dlqQueue).toBeDefined();

      expect(dlqQueue.name).toBe(QUEUE_NAMES.DLQ);

      expect(await dlqQueue.getJobCounts()).toBeDefined();
    });
  });

  // =========================================================================
  // QUEUE CONFIGURATION
  // =========================================================================

  describe('Queue configuration', () => {
    it('configures email queue with five attempts and exponential backoff', async () => {
      const job = await emailQueue.add('EMAIL_REQUESTED', {
        test: true,
      });

      expect(job.opts.attempts).toBe(5);

      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 5000,
      });

      expect(job.opts.removeOnComplete).toBe(100);

      expect(job.opts.removeOnFail).toBe(false);
    });

    it('configures reminder queue with three attempts and exponential backoff', async () => {
      const job = await reminderQueue.add('REMINDER_DUE', {
        test: true,
      });

      expect(job.opts.attempts).toBe(3);

      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 5000,
      });

      expect(job.opts.removeOnComplete).toBe(100);

      expect(job.opts.removeOnFail).toBe(false);
    });

    it('configures webhook queue with five attempts and exponential backoff', async () => {
      const job = await webhookQueue.add('TASK_CREATED', {
        test: true,
      });

      expect(job.opts.attempts).toBe(5);

      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 5000,
      });

      expect(job.opts.removeOnComplete).toBe(100);

      expect(job.opts.removeOnFail).toBe(false);
    });

    it('configures export queue with three attempts and exponential backoff', async () => {
      const job = await exportQueue.add('EXPORT_REQUESTED', {
        test: true,
      });

      expect(job.opts.attempts).toBe(3);

      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 5000,
      });

      expect(job.opts.removeOnComplete).toBe(100);

      expect(job.opts.removeOnFail).toBe(false);
    });

    it('configures the dead-letter queue without retry attempts', async () => {
      const job = await dlqQueue.add('dead-letter-job', {
        queueName: QUEUE_NAMES.EMAIL,
        error: 'integration-test',
        attempts: 5,
      });

      expect(job.opts.attempts).toBe(0);

      expect(job.opts.removeOnComplete).toBe(100);

      expect(job.opts.removeOnFail).toBe(false);
    });
  });

  // =========================================================================
  // EMAIL PROCESSOR
  // =========================================================================

  describe('EmailProcessor', () => {
    it('processes EMAIL_REQUESTED verification email successfully', async () => {
      const delivery = fakeEmailDelivery();

      const findDeliverySpy = jest
        .spyOn(emailDeliveryRepository, 'findByOutboxEventId')
        .mockResolvedValue(delivery);

      const updateSpy = jest
        .spyOn(emailDeliveryRepository, 'update')
        .mockResolvedValue(delivery);

      const sendSpy = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue();

      const outboxEventId = new Types.ObjectId().toString();

      const job = createJob(
        {
          outboxEventId,
          eventType: 'EMAIL_REQUESTED',
          correlationId: 'email-correlation-id',
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'test@example.com',
            token: 'verification-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        },
        {
          attempts: 0,
          attemptsMade: 0,
        },
      );

      await emailProcessor.process(job);

      expect(findDeliverySpy).toHaveBeenCalledWith(
        new Types.ObjectId(outboxEventId),
      );

      expect(sendSpy).toHaveBeenCalledWith(
        'test@example.com',
        'verification-token',
        expect.any(Date),
      );

      expect(updateSpy).toHaveBeenCalled();

      expect(updateSpy.mock.calls[0][1]).toMatchObject({
        status: EmailDeliveryStatus.SENDING,
        attempts: 1,
      });

      expect(updateSpy.mock.calls[1][1]).toMatchObject({
        status: EmailDeliveryStatus.SENT,
      });
    });

    it('processes PASSWORD_RESET email successfully', async () => {
      const delivery = fakeEmailDelivery();

      jest
        .spyOn(emailDeliveryRepository, 'findByOutboxEventId')
        .mockResolvedValue(delivery);

      jest.spyOn(emailDeliveryRepository, 'update').mockResolvedValue(delivery);

      const sendSpy = jest
        .spyOn(mailService, 'sendPasswordResetEmail')
        .mockResolvedValue();

      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'PASSWORD_RESET',
          to: 'reset@example.com',
          token: 'reset-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });

      await emailProcessor.process(job);

      expect(sendSpy).toHaveBeenCalledWith(
        'reset@example.com',
        'reset-token',
        expect.any(Date),
      );
    });

    it('processes WORKSPACE_INVITATION email successfully', async () => {
      const delivery = fakeEmailDelivery();

      jest
        .spyOn(emailDeliveryRepository, 'findByOutboxEventId')
        .mockResolvedValue(delivery);

      jest.spyOn(emailDeliveryRepository, 'update').mockResolvedValue(delivery);

      const sendSpy = jest
        .spyOn(mailService, 'sendWorkspaceInvitation')
        .mockResolvedValue();

      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'WORKSPACE_INVITATION',
          to: 'invite@example.com',
          workspaceName: 'Integration Workspace',
          token: 'invite-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });

      await emailProcessor.process(job);

      expect(sendSpy).toHaveBeenCalledWith(
        'invite@example.com',
        'Integration Workspace',
        'invite-token',
        expect.any(Date),
      );
    });

    it('rejects an email job without eventType', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        payload: {},
      });

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'Email job is missing eventType',
      );
    });

    it('rejects an email job without payload', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EMAIL_REQUESTED',
      });

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'Email job is missing payload',
      );
    });

    it('rejects an email job without outboxEventId', async () => {
      const job = createJob({
        eventType: 'EMAIL_REQUESTED',
        payload: {},
      });

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'Email job is missing outboxEventId',
      );
    });

    it('moves a permanently failed email job to the DLQ', async () => {
      const delivery = fakeEmailDelivery();

      jest
        .spyOn(emailDeliveryRepository, 'findByOutboxEventId')
        .mockResolvedValue(delivery);

      jest.spyOn(emailDeliveryRepository, 'update').mockResolvedValue(delivery);

      jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockRejectedValue(new Error('SMTP permanently unavailable'));

      const dlqSpy = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue();

      const jobId = 'email-final-attempt-job';

      const outboxEventId = new Types.ObjectId().toString();

      const job = createJob(
        {
          outboxEventId,
          eventType: 'EMAIL_REQUESTED',
          correlationId: 'email-dlq-correlation',
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'failed@example.com',
            token: 'token',
            expiresAt: new Date().toISOString(),
          },
        },
        {
          id: jobId,
          attemptsMade: 4,
          attempts: 5,
        },
      );

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'SMTP permanently unavailable',
      );

      expect(dlqSpy).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.EMAIL,
        jobId,
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        payload: job.data.payload,
        error: 'SMTP permanently unavailable',
        attempts: 5,
        correlationId: 'email-dlq-correlation',
      });
    });
  });

  // =========================================================================
  // REMINDER PROCESSOR
  // =========================================================================

  describe('ReminderProcessor', () => {
    it('processes a reminder successfully', async () => {
      const delivery = fakeEmailDelivery();

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      jest
        .spyOn(emailDeliveryRepository, 'findByOutboxEventId')
        .mockResolvedValue(delivery);

      const updateSpy = jest
        .spyOn(emailDeliveryRepository, 'update')
        .mockResolvedValue(delivery);

      const sendSpy = jest
        .spyOn(mailService, 'sendReminderEmail')
        .mockResolvedValue();

      const markProcessedSpy = jest
        .spyOn(processedEventRepository, 'markProcessed')
        .mockResolvedValue();

      const outboxEventId = new Types.ObjectId().toString();

      const job = createJob({
        outboxEventId,
        eventType: 'REMINDER_DUE',
        correlationId: 'reminder-correlation',
        payload: {
          to: 'reminder@example.com',
          taskTitle: 'Integration test task',
          dueDate: new Date(Date.now() + 3600000).toISOString(),
          priority: 'high',
        },
      });

      await reminderProcessor.process(job);

      expect(sendSpy).toHaveBeenCalledWith(
        'reminder@example.com',
        'Integration test task',
        expect.any(Date),
        'high',
      );

      expect(updateSpy.mock.calls[0][1]).toMatchObject({
        status: EmailDeliveryStatus.SENDING,
        attempts: 1,
      });

      expect(updateSpy.mock.calls[1][1]).toMatchObject({
        status: EmailDeliveryStatus.SENT,
      });

      expect(markProcessedSpy).toHaveBeenCalledWith(
        outboxEventId,
        'REMINDER_DUE',
      );
    });

    it('skips an already processed reminder', async () => {
      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(true);

      const sendSpy = jest
        .spyOn(mailService, 'sendReminderEmail')
        .mockResolvedValue();

      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'REMINDER_DUE',
        payload: {
          to: 'already@example.com',
          taskTitle: 'Already processed',
          dueDate: new Date().toISOString(),
          priority: 'low',
        },
      });

      await reminderProcessor.process(job);

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('rejects a reminder job without outboxEventId', async () => {
      const job = createJob({
        eventType: 'REMINDER_DUE',
        payload: {},
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Reminder job is missing outboxEventId',
      );
    });

    it('rejects a reminder job without eventType', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        payload: {},
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Reminder job is missing eventType',
      );
    });

    it('rejects a reminder job without payload', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'REMINDER_DUE',
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Reminder job is missing payload',
      );
    });

    it('moves a permanently failed reminder to the DLQ', async () => {
      const delivery = fakeEmailDelivery();

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      jest
        .spyOn(emailDeliveryRepository, 'findByOutboxEventId')
        .mockResolvedValue(delivery);

      jest.spyOn(emailDeliveryRepository, 'update').mockResolvedValue(delivery);

      jest
        .spyOn(mailService, 'sendReminderEmail')
        .mockRejectedValue(new Error('Reminder delivery failed'));

      const dlqSpy = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue();

      const outboxEventId = new Types.ObjectId().toString();

      const job = createJob(
        {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          payload: {
            to: 'failed@example.com',
            taskTitle: 'Failed reminder',
            dueDate: new Date().toISOString(),
            priority: 'medium',
          },
        },
        {
          id: 'reminder-final-job',
          attemptsMade: 2,
          attempts: 3,
        },
      );

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Reminder delivery failed',
      );

      expect(dlqSpy).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.REMINDER,
        jobId: 'reminder-final-job',
        outboxEventId,
        eventType: 'REMINDER_DUE',
        payload: job.data.payload,
        error: 'Reminder delivery failed',
        attempts: 3,
        correlationId: undefined,
      });
    });
  });

  // =========================================================================
  // WEBHOOK PROCESSOR - QUEUE LEVEL
  // =========================================================================

  describe('WebhookProcessor queue integration', () => {
    it('has the webhook processor registered for the webhook queue', () => {
      expect(webhookProcessor).toBeDefined();

      expect(webhookProcessor.getWorker()).toBeDefined();
    });

    it('places webhook jobs in the real Redis-backed queue', async () => {
      const job = await webhookQueue.add(
        'TASK_CREATED',
        {
          outboxEventId: new Types.ObjectId().toString(),
          workspaceId: new Types.ObjectId().toString(),
          eventType: 'TASK_CREATED',
          payload: {
            taskId: new Types.ObjectId().toString(),
          },
        },
        {
          jobId: `webhook-integration-${new Types.ObjectId().toString()}`,
        },
      );

      expect(job.id).toBeDefined();

      const jobs = await getJobs(webhookQueue);

      expect(jobs.some((candidate) => candidate.id === job.id)).toBe(true);
    });

    it('does not move a webhook job to the DLQ before its final attempt', async () => {
      const dlqSpy = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue();

      const job = createJob(
        {
          outboxEventId: new Types.ObjectId().toString(),
          workspaceId: new Types.ObjectId().toString(),
          eventType: 'TASK_CREATED',
          payload: {
            taskId: 'queue-test-task',
          },
        },
        {
          attemptsMade: 0,
          attempts: 5,
        },
      );

      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      const webhookService = app.get<WebhookService>(WebhookService);

      if (webhookService) {
        jest
          .spyOn(webhookService, 'deliverToWorkspace')
          .mockRejectedValue(new Error('Temporary webhook failure'));
      }

      await expect(webhookProcessor.process(job)).rejects.toThrow();

      expect(dlqSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPORT PROCESSOR
  // =========================================================================

  describe('ExportProcessor', () => {
    it('processes a valid export successfully', async () => {
      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      const generateExportSpy = jest
        .spyOn(exportService, 'generateExport')
        .mockResolvedValue(undefined);

      const markProcessedSpy = jest
        .spyOn(processedEventRepository, 'markProcessed')
        .mockResolvedValue();

      const outboxEventId = new Types.ObjectId().toString();

      const job = createJob({
        outboxEventId,
        eventType: 'EXPORT_REQUESTED',
        correlationId: 'export-correlation-id',
        payload: {
          exportId: new Types.ObjectId().toString(),
          workspaceId: new Types.ObjectId().toString(),
          userId: new Types.ObjectId().toString(),
          format: 'JSON',
        },
      });

      await exportProcessor.process(job);

      expect(generateExportSpy).toHaveBeenCalledWith({
        workspaceId: job.data.payload.workspaceId,
        userId: job.data.payload.userId,
        format: job.data.payload.format,
        outboxEventId,
      });

      expect(markProcessedSpy).toHaveBeenCalledWith(
        outboxEventId,
        'EXPORT_REQUESTED',
      );
    });

    it('skips an already processed export', async () => {
      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(true);

      const generateExportSpy = jest
        .spyOn(exportService, 'generateExport')
        .mockResolvedValue(undefined);

      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EXPORT_REQUESTED',
        payload: {
          exportId: new Types.ObjectId().toString(),
          workspaceId: new Types.ObjectId().toString(),
          userId: new Types.ObjectId().toString(),
          format: 'JSON',
        },
      });

      await exportProcessor.process(job);

      expect(generateExportSpy).not.toHaveBeenCalled();
    });

    it('rejects an export job without outboxEventId', async () => {
      const job = createJob({
        eventType: 'EXPORT_REQUESTED',
        payload: {
          exportId: new Types.ObjectId().toString(),
        },
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export job is missing outboxEventId',
      );
    });

    it('rejects an export job without eventType', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        payload: {
          exportId: new Types.ObjectId().toString(),
        },
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export job is missing eventType',
      );
    });

    it('rejects an export job without payload', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EXPORT_REQUESTED',
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export job is missing payload',
      );
    });

    it('rejects an export job without exportId', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EXPORT_REQUESTED',
        payload: {},
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export job is missing exportId',
      );
    });

    it('rejects an unsupported export event type', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EXPORT_FAILED',
        payload: {
          exportId: new Types.ObjectId().toString(),
        },
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Unsupported export event type: EXPORT_FAILED',
      );
    });

    it('moves a permanently failed export to the DLQ', async () => {
      jest
        .spyOn(processedEventRepository, 'hasBeenProcessed')
        .mockResolvedValue(false);

      jest
        .spyOn(exportService, 'generateExport')
        .mockRejectedValue(new Error('Export generation failed'));

      const updateSpy = jest
        .spyOn(exportRepository, 'update')
        .mockResolvedValue(undefined as any);

      const dlqSpy = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue();

      const outboxEventId = new Types.ObjectId().toString();

      const exportId = new Types.ObjectId().toString();

      const job = createJob(
        {
          outboxEventId,
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'export-dlq-correlation',
          payload: {
            exportId,
            workspaceId: new Types.ObjectId().toString(),
            userId: new Types.ObjectId().toString(),
            format: 'CSV',
          },
        },
        {
          id: 'export-final-job',
          attemptsMade: 2,
          attempts: 3,
        },
      );

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export generation failed',
      );

      expect(updateSpy).toHaveBeenCalledWith(
        exportId,
        expect.objectContaining({
          error: 'Export generation failed',
        }),
      );

      expect(dlqSpy).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.EXPORT,
        jobId: 'export-final-job',
        outboxEventId,
        eventType: 'EXPORT_REQUESTED',
        payload: job.data.payload,
        error: 'Export generation failed',
        attempts: 3,
        correlationId: 'export-dlq-correlation',
      });
    });
  });

  // =========================================================================
  // DEAD LETTER SERVICE
  // =========================================================================

  describe('DeadLetterService', () => {
    it('moves a failed job to the real dead-letter queue', async () => {
      const jobId = 'source-email-job';

      const outboxEventId = new Types.ObjectId().toString();

      await deadLetterService.moveToDeadLetterQueue({
        queueName: QUEUE_NAMES.EMAIL,
        jobId,
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'EMAIL_VERIFICATION',
          to: 'failed@example.com',
        },
        error: 'SMTP unavailable',
        attempts: 5,
        correlationId: 'dlq-correlation-id',
      });

      const jobs = await getJobs(dlqQueue);

      const job = jobs.find((candidate) => candidate.id === `dlq-${jobId}`);

      expect(job).toBeDefined();

      expect(job?.name).toBe('dead-letter-job');

      expect(job?.data).toMatchObject({
        queueName: QUEUE_NAMES.EMAIL,
        jobId,
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'EMAIL_VERIFICATION',
          to: 'failed@example.com',
        },
        error: 'SMTP unavailable',
        attempts: 5,
        correlationId: 'dlq-correlation-id',
      });

      expect(job?.data.failedAt).toEqual(expect.any(String));
    });

    it('preserves the source queue and failure metadata in the DLQ', async () => {
      await deadLetterService.moveToDeadLetterQueue({
        queueName: QUEUE_NAMES.WEBHOOK,
        jobId: 'webhook-source-job',
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'TASK_CREATED',
        payload: {
          taskId: 'task-1',
        },
        error: 'Webhook endpoint unavailable',
        attempts: 5,
      });

      const jobs = await getJobs(dlqQueue);

      const job = jobs.find(
        (candidate) => candidate.id === 'dlq-webhook-source-job',
      );

      expect(job).toBeDefined();

      expect(job?.data.queueName).toBe(QUEUE_NAMES.WEBHOOK);

      expect(job?.data.error).toBe('Webhook endpoint unavailable');

      expect(job?.data.attempts).toBe(5);
    });
  });

  // =========================================================================
  // DEAD LETTER PROCESSOR
  // =========================================================================

  describe('DeadLetterProcessor', () => {
    it('is registered for the dead-letter queue', () => {
      expect(deadLetterProcessor).toBeDefined();

      expect(deadLetterProcessor.getWorker()).toBeDefined();
    });

    it('processes a dead-letter job without throwing', async () => {
      const job = createJob({
        queueName: QUEUE_NAMES.EMAIL,
        jobId: 'failed-email-job',
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'EMAIL_VERIFICATION',
          to: 'failed@example.com',
        },
        error: 'SMTP unavailable',
        attempts: 5,
        failedAt: new Date().toISOString(),
        correlationId: 'dlq-processor-correlation',
      });

      await expect(deadLetterProcessor.process(job)).resolves.toBeUndefined();
    });

    it('can process a DLQ job created by DeadLetterService', async () => {
      await deadLetterService.moveToDeadLetterQueue({
        queueName: QUEUE_NAMES.EXPORT,
        jobId: 'export-failed-job',
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EXPORT_REQUESTED',
        payload: {
          exportId: new Types.ObjectId().toString(),
        },
        error: 'Export failed',
        attempts: 3,
        correlationId: 'dlq-export-correlation',
      });

      const jobs = await getJobs(dlqQueue);

      const job = jobs.find(
        (candidate) => candidate.id === 'dlq-export-failed-job',
      );

      expect(job).toBeDefined();

      await expect(deadLetterProcessor.process(job)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // QUEUE METRICS
  // =========================================================================

  describe('QueueMetricsService', () => {
    it('updates metrics for all registered queues', async () => {
      const waitingSpy = jest
        .spyOn(metricsService.queueWaitingJobs, 'set')
        .mockImplementation((() => {}) as any);

      const activeSpy = jest
        .spyOn(metricsService.queueActiveJobs, 'set')
        .mockImplementation((() => {}) as any);

      const delayedSpy = jest
        .spyOn(metricsService.queueDelayedJobs, 'set')
        .mockImplementation((() => {}) as any);

      const failedSpy = jest
        .spyOn(metricsService.queueFailedJobs, 'set')
        .mockImplementation((() => {}) as any);

      await queueMetricsService.updateMetrics();

      expect(waitingSpy).toHaveBeenCalledTimes(5);

      expect(activeSpy).toHaveBeenCalledTimes(5);

      expect(delayedSpy).toHaveBeenCalledTimes(5);

      expect(failedSpy).toHaveBeenCalledTimes(5);

      expect(waitingSpy).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        expect.any(Number),
      );

      expect(waitingSpy).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.REMINDER },
        expect.any(Number),
      );

      expect(waitingSpy).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.WEBHOOK },
        expect.any(Number),
      );

      expect(waitingSpy).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EXPORT },
        expect.any(Number),
      );

      expect(waitingSpy).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.DLQ },
        expect.any(Number),
      );
    });

    it('reports actual waiting jobs from Redis', async () => {
      await emailQueue.pause();

      try {
        await emailQueue.add('EMAIL_REQUESTED', {
          integration: true,
        });

        let emailWaitingJobs = 0;

        jest
          .spyOn(metricsService.queueWaitingJobs, 'set')
          .mockImplementation((labelsOrValue: any, value?: number) => {
            if (
              typeof labelsOrValue === 'object' &&
              labelsOrValue.queue === QUEUE_NAMES.EMAIL
            ) {
              emailWaitingJobs = value ?? 0;
            }
          });

        await queueMetricsService.updateMetrics();

        expect(emailWaitingJobs).toBeGreaterThanOrEqual(1);
      } finally {
        await emailQueue.resume();
      }
    });
    // =========================================================================
    // REAL REDIS QUEUE PERSISTENCE
    // =========================================================================

    describe('Redis-backed queue persistence', () => {
      it('persists email jobs in Redis', async () => {
        const jobId = `email-redis-${new Types.ObjectId().toString()}`;

        await emailQueue.add(
          'EMAIL_REQUESTED',
          {
            outboxEventId: new Types.ObjectId().toString(),
            eventType: 'EMAIL_REQUESTED',
            payload: {
              emailType: 'EMAIL_VERIFICATION',
              to: 'redis@example.com',
            },
          },
          {
            jobId,
          },
        );

        const jobs = await getJobs(emailQueue);

        const job = jobs.find((candidate) => candidate.id === jobId);

        expect(job).toBeDefined();

        expect(job?.data).toMatchObject({
          eventType: 'EMAIL_REQUESTED',
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'redis@example.com',
          },
        });
      });

      it('persists jobs independently across queues', async () => {
        await emailQueue.add(
          'EMAIL_REQUESTED',
          {
            queueTest: 'email',
          },
          {
            jobId: 'queue-isolation-email',
          },
        );

        await reminderQueue.add(
          'REMINDER_DUE',
          {
            queueTest: 'reminder',
          },
          {
            jobId: 'queue-isolation-reminder',
          },
        );

        const emailJobs = await getJobs(emailQueue);

        const reminderJobs = await getJobs(reminderQueue);

        expect(
          emailJobs.some((job) => job.id === 'queue-isolation-email'),
        ).toBe(true);

        expect(
          reminderJobs.some((job) => job.id === 'queue-isolation-reminder'),
        ).toBe(true);

        expect(
          reminderJobs.some((job) => job.id === 'queue-isolation-email'),
        ).toBe(false);

        expect(
          emailJobs.some((job) => job.id === 'queue-isolation-reminder'),
        ).toBe(false);
      });
    });
  });
});
