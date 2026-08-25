import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { Job } from 'bullmq';

import { AppModule } from '../../../src/app.module';

import { clearDatabase } from '../setup/database';
import { clearRedis } from '../setup/redis';

import { shutdownIntegrationApp } from '../helpers/shutdown-helper';

import { DeadLetterProcessor } from '../../../src/infrastructure/processors/dead-letter.processor';
import { EmailProcessor } from '../../../src/infrastructure/processors/email.processor';
import { ExportProcessor } from '../../../src/infrastructure/processors/export.processor';
import { ReminderProcessor } from '../../../src/infrastructure/processors/reminder.processor';
import { WebhookProcessor } from '../../../src/infrastructure/processors/webhook.processor';

import { DeadLetterService } from '../../../src/infrastructure/queues/dead-letter.service';
import { QUEUE_NAMES } from '../../../src/infrastructure/queues/queue.constants';

import { MailService } from '../../../src/mail/mail.service';

import { EMAIL_DELIVERY_REPOSITORY } from '../../../src/mail/domain/constants/repository.tokens';

import type { IEmailDeliveryRepository } from '../../../src/mail/domain/repositories/email-delivery.repository.interface';

import { EmailDeliveryStatus } from '../../../src/mail/domain/enums/email-delivery-status.enum';

import { PROCESSED_EVENT_REPOSITORY } from '../../../src/outbox/domain/constants/repository.tokens';

import type { IProcessedEventRepository } from '../../../src/outbox/domain/repositories/processed-event.repository.interface';

import { EXPORT_REPOSITORY } from '../../../src/export/domain/constants/repository.tokens';

import type { IExportRepository } from '../../../src/export/domain/repositories/export.repository.interface';

import { ExportStatus } from '../../../src/export/domain/enums/export-status.enum';

import { ExportService } from '../../../src/export/application/export.service';
import { WebhookService } from '../../../src/webhook/application/webhook.service';

jest.setTimeout(30000);

function createJob(
  data: Record<string, unknown>,
  options?: {
    id?: string;
    attemptsMade?: number;
    attempts?: number;
  },
): Job {
  return {
    id: options?.id ?? `test-job-${new Types.ObjectId().toString()}`,
    data,
    attemptsMade: options?.attemptsMade ?? 0,
    opts: {
      attempts: options?.attempts ?? 1,
    },
  } as Job;
}

describe('Infrastructure Processors Integration - Experimental', () => {
  let app: INestApplication;
  let connection: Connection;

  let deadLetterProcessor: DeadLetterProcessor;
  let emailProcessor: EmailProcessor;
  let exportProcessor: ExportProcessor;
  let reminderProcessor: ReminderProcessor;
  let webhookProcessor: WebhookProcessor;

  let mailService: MailService;
  let exportService: ExportService;
  let webhookService: WebhookService;
  let deadLetterService: DeadLetterService;

  let emailDeliveryRepository: IEmailDeliveryRepository;
  let processedEventRepository: IProcessedEventRepository;
  let exportRepository: IExportRepository;

  // ---------------------------------------------------------------------------
  // Experimental bootstrap
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    /**
     * -------------------------------------------------------------------------
     * Experimental bootstrap
     * -------------------------------------------------------------------------
     *
     * This intentionally does NOT use:
     *
     *   - ../setup/test-env
     *   - createIntegrationApp()
     *
     * Instead, the real AppModule is bootstrapped directly, matching the
     * experimental Metrics integration test.
     *
     * This lets us determine whether the processor integration failures are
     * caused by the shared integration-test bootstrap rather than by the
     * processors themselves.
     * -------------------------------------------------------------------------
     */

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    /**
     * Match the normal application / experimental Metrics bootstrap.
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

    connection = app.get<Connection>(getConnectionToken());

    // -------------------------------------------------------------------------
    // Resolve processors
    // -------------------------------------------------------------------------

    deadLetterProcessor = app.get(DeadLetterProcessor);
    emailProcessor = app.get(EmailProcessor);
    exportProcessor = app.get(ExportProcessor);
    reminderProcessor = app.get(ReminderProcessor);
    webhookProcessor = app.get(WebhookProcessor);

    // -------------------------------------------------------------------------
    // Resolve services
    // -------------------------------------------------------------------------

    mailService = app.get(MailService);
    exportService = app.get(ExportService);
    webhookService = app.get(WebhookService);
    deadLetterService = app.get(DeadLetterService);

    // -------------------------------------------------------------------------
    // Resolve repositories
    // -------------------------------------------------------------------------

    emailDeliveryRepository = app.get(EMAIL_DELIVERY_REPOSITORY);

    processedEventRepository = app.get(PROCESSED_EVENT_REPOSITORY);

    exportRepository = app.get(EXPORT_REPOSITORY);
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(connection);
    await clearRedis();

    jest.restoreAllMocks();
  });

  afterAll(async () => {
    jest.restoreAllMocks();

    if (app) {
      await shutdownIntegrationApp(app, connection);
    }
  }, 30000);

  // ===========================================================================
  // Dead Letter Processor
  // ===========================================================================

  describe('DeadLetterProcessor', () => {
    it('should process a dead-letter job successfully', async () => {
      const job = createJob({
        queueName: QUEUE_NAMES.EMAIL,
        jobId: 'email-job-1',
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'EMAIL_VERIFICATION',
          to: 'test@example.com',
        },
        error: 'SMTP provider unavailable',
        attempts: 3,
        failedAt: new Date().toISOString(),
        correlationId: 'correlation-dlq-1',
      });

      await expect(deadLetterProcessor.process(job)).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // Email Processor
  // ===========================================================================

  describe('EmailProcessor', () => {
    async function createEmailDelivery(
      outboxEventId: string,
      emailType: string,
      to = 'test@example.com',
    ) {
      return emailDeliveryRepository.create({
        outboxEventId: new Types.ObjectId(outboxEventId),
        to,
        emailType,
        status: EmailDeliveryStatus.QUEUED,
        attempts: 0,
      });
    }

    it('should process EMAIL_VERIFICATION successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createEmailDelivery(outboxEventId, 'EMAIL_VERIFICATION');

      const sendVerificationEmail = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      const job = createJob({
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        correlationId: 'email-correlation-1',
        payload: {
          emailType: 'EMAIL_VERIFICATION',
          to: 'test@example.com',
          token: 'verification-token',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });

      await emailProcessor.process(job);

      expect(sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'verification-token',
        expect.any(Date),
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery).not.toBeNull();
      expect(delivery?.status).toBe(EmailDeliveryStatus.SENT);
      expect(delivery?.attempts).toBe(1);
      expect(delivery?.sentAt).toEqual(expect.any(Date));
    });

    it('should process PASSWORD_RESET successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createEmailDelivery(outboxEventId, 'PASSWORD_RESET');

      const sendPasswordResetEmail = jest
        .spyOn(mailService, 'sendPasswordResetEmail')
        .mockResolvedValue(undefined);

      const job = createJob({
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'PASSWORD_RESET',
          to: 'reset@example.com',
          token: 'reset-token',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });

      await emailProcessor.process(job);

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'reset@example.com',
        'reset-token',
        expect.any(Date),
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery?.status).toBe(EmailDeliveryStatus.SENT);
    });

    it('should process WORKSPACE_INVITATION successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createEmailDelivery(outboxEventId, 'WORKSPACE_INVITATION');

      const sendWorkspaceInvitation = jest
        .spyOn(mailService, 'sendWorkspaceInvitation')
        .mockResolvedValue(undefined);

      const job = createJob({
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'WORKSPACE_INVITATION',
          to: 'invite@example.com',
          workspaceName: 'Test Workspace',
          token: 'invitation-token',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });

      await emailProcessor.process(job);

      expect(sendWorkspaceInvitation).toHaveBeenCalledWith(
        'invite@example.com',
        'Test Workspace',
        'invitation-token',
        expect.any(Date),
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery?.status).toBe(EmailDeliveryStatus.SENT);
    });

    it('should process TASK_REMINDER successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createEmailDelivery(outboxEventId, 'TASK_REMINDER');

      const sendReminderEmail = jest
        .spyOn(mailService, 'sendReminderEmail')
        .mockResolvedValue(undefined);

      const dueDate = new Date(Date.now() + 60 * 60 * 1000);

      const job = createJob({
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'TASK_REMINDER',
          to: 'reminder@example.com',
          taskTitle: 'Finish integration tests',
          dueDate: dueDate.toISOString(),
          priority: 'high',
        },
      });

      await emailProcessor.process(job);

      expect(sendReminderEmail).toHaveBeenCalledWith(
        'reminder@example.com',
        'Finish integration tests',
        expect.any(Date),
        'high',
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery?.status).toBe(EmailDeliveryStatus.SENT);
    });

    it('should reject a job with missing eventType', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        payload: {},
      });

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'Email job is missing eventType',
      );
    });

    it('should reject a job with missing payload', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EMAIL_REQUESTED',
      });

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'Email job is missing payload',
      );
    });

    it('should reject a job with missing outboxEventId', async () => {
      const job = createJob({
        eventType: 'EMAIL_REQUESTED',
        payload: {},
      });

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'Email job is missing outboxEventId',
      );
    });

    it('should reject when the email delivery record does not exist', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const job = createJob({
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'EMAIL_VERIFICATION',
          to: 'test@example.com',
        },
      });

      await expect(emailProcessor.process(job)).rejects.toThrow(
        `Email delivery record not found for outbox event ${outboxEventId}`,
      );
    });

    it('should reject an unsupported email event type', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createEmailDelivery(outboxEventId, 'EMAIL_VERIFICATION');

      const job = createJob({
        outboxEventId,
        eventType: 'UNSUPPORTED_EVENT',
        payload: {
          emailType: 'EMAIL_VERIFICATION',
          to: 'test@example.com',
        },
      });

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'Unsupported email event type: UNSUPPORTED_EVENT',
      );
    });

    it('should update delivery state after a non-final failed attempt', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createEmailDelivery(outboxEventId, 'EMAIL_VERIFICATION');

      jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockRejectedValue(new Error('SMTP temporarily unavailable'));

      const moveToDeadLetterQueue = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue(undefined);

      const job = createJob(
        {
          outboxEventId,
          eventType: 'EMAIL_REQUESTED',
          correlationId: 'retry-correlation',
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'test@example.com',
            token: 'token',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        },
        {
          attemptsMade: 0,
          attempts: 3,
        },
      );

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'SMTP temporarily unavailable',
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery?.attempts).toBe(1);
      expect(delivery?.lastError).toBe('SMTP temporarily unavailable');

      expect(moveToDeadLetterQueue).not.toHaveBeenCalled();
    });

    it('should mark delivery as FAILED and move it to DLQ on final failure', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createEmailDelivery(outboxEventId, 'EMAIL_VERIFICATION');

      jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockRejectedValue(new Error('SMTP permanently unavailable'));

      const moveToDeadLetterQueue = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue(undefined);

      const job = createJob(
        {
          outboxEventId,
          eventType: 'EMAIL_REQUESTED',
          correlationId: 'final-failure-correlation',
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'test@example.com',
            token: 'token',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        },
        {
          attemptsMade: 0,
          attempts: 1,
        },
      );

      await expect(emailProcessor.process(job)).rejects.toThrow(
        'SMTP permanently unavailable',
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery?.status).toBe(EmailDeliveryStatus.FAILED);
      expect(delivery?.attempts).toBe(1);
      expect(delivery?.lastError).toBe('SMTP permanently unavailable');
      expect(delivery?.failedAt).toEqual(expect.any(Date));

      expect(moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: QUEUE_NAMES.EMAIL,
          jobId: job.id,
          outboxEventId,
          eventType: 'EMAIL_REQUESTED',
          attempts: 1,
          error: 'SMTP permanently unavailable',
        }),
      );
    });
  });

  // ===========================================================================
  // Export Processor
  // ===========================================================================

  describe('ExportProcessor', () => {
    async function createExportRecord(
      outboxEventId: string,
      workspaceId = new Types.ObjectId().toString(),
      userId = new Types.ObjectId().toString(),
    ) {
      return exportRepository.create({
        outboxEventId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.QUEUED,
      });
    }

    it('should process an EXPORT_REQUESTED job successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const workspaceId = new Types.ObjectId().toString();

      const userId = new Types.ObjectId().toString();

      const exportRecord = await createExportRecord(
        outboxEventId,
        workspaceId,
        userId,
      );

      const generateExport = jest
        .spyOn(exportService, 'generateExport')
        .mockResolvedValue(undefined);

      const job = createJob({
        outboxEventId,
        eventType: 'EXPORT_REQUESTED',
        correlationId: 'export-correlation-1',
        payload: {
          exportId: exportRecord._id.toString(),
          workspaceId,
          userId,
          format: 'json',
        },
      });

      await exportProcessor.process(job);

      expect(generateExport).toHaveBeenCalledWith({
        workspaceId,
        userId,
        format: 'json',
        outboxEventId,
      });

      expect(
        await processedEventRepository.hasBeenProcessed(outboxEventId),
      ).toBe(true);
    });

    it('should skip an already processed export event', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const workspaceId = new Types.ObjectId().toString();

      const userId = new Types.ObjectId().toString();

      const exportRecord = await createExportRecord(
        outboxEventId,
        workspaceId,
        userId,
      );

      await processedEventRepository.markProcessed(
        outboxEventId,
        'EXPORT_REQUESTED',
      );

      const generateExport = jest
        .spyOn(exportService, 'generateExport')
        .mockResolvedValue(undefined);

      const job = createJob({
        outboxEventId,
        eventType: 'EXPORT_REQUESTED',
        payload: {
          exportId: exportRecord._id.toString(),
          workspaceId,
          userId,
          format: 'json',
        },
      });

      await exportProcessor.process(job);

      expect(generateExport).not.toHaveBeenCalled();
    });

    it('should reject a job with missing outboxEventId', async () => {
      const job = createJob({
        eventType: 'EXPORT_REQUESTED',
        payload: {},
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export job is missing outboxEventId',
      );
    });

    it('should reject a job with missing eventType', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        payload: {},
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export job is missing eventType',
      );
    });

    it('should reject a job with missing payload', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EXPORT_REQUESTED',
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export job is missing payload',
      );
    });

    it('should reject a job with missing exportId', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'EXPORT_REQUESTED',
        payload: {
          workspaceId: new Types.ObjectId().toString(),
          userId: new Types.ObjectId().toString(),
          format: 'json',
        },
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export job is missing exportId',
      );
    });

    it('should reject an unsupported export event type', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const exportRecord = await createExportRecord(outboxEventId);

      const job = createJob({
        outboxEventId,
        eventType: 'UNSUPPORTED_EXPORT_EVENT',
        payload: {
          exportId: exportRecord._id.toString(),
        },
      });

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Unsupported export event type: UNSUPPORTED_EXPORT_EVENT',
      );
    });

    it('should mark export as FAILED and move it to DLQ on final failure', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const workspaceId = new Types.ObjectId().toString();

      const userId = new Types.ObjectId().toString();

      const exportRecord = await createExportRecord(
        outboxEventId,
        workspaceId,
        userId,
      );

      jest
        .spyOn(exportService, 'generateExport')
        .mockRejectedValue(new Error('Export generation failed'));

      const moveToDeadLetterQueue = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue(undefined);

      const job = createJob(
        {
          outboxEventId,
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'export-failure-correlation',
          payload: {
            exportId: exportRecord._id.toString(),
            workspaceId,
            userId,
            format: 'json',
          },
        },
        {
          attemptsMade: 0,
          attempts: 1,
        },
      );

      await expect(exportProcessor.process(job)).rejects.toThrow(
        'Export generation failed',
      );

      const updatedExport = await exportRepository.findById(
        exportRecord._id.toString(),
      );

      expect(updatedExport?.status).toBe(ExportStatus.FAILED);

      expect(updatedExport?.error).toBe('Export generation failed');

      expect(moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: QUEUE_NAMES.EXPORT,
          jobId: job.id,
          outboxEventId,
          eventType: 'EXPORT_REQUESTED',
          attempts: 1,
          error: 'Export generation failed',
        }),
      );
    });
  });

  // ===========================================================================
  // Reminder Processor
  // ===========================================================================

  describe('ReminderProcessor', () => {
    async function createReminderDelivery(outboxEventId: string) {
      return emailDeliveryRepository.create({
        outboxEventId: new Types.ObjectId(outboxEventId),
        to: 'reminder@example.com',
        emailType: 'TASK_REMINDER',
        status: EmailDeliveryStatus.QUEUED,
        attempts: 0,
      });
    }

    it('should process REMINDER_DUE successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createReminderDelivery(outboxEventId);

      const sendReminderEmail = jest
        .spyOn(mailService, 'sendReminderEmail')
        .mockResolvedValue(undefined);

      const dueDate = new Date(Date.now() + 60 * 60 * 1000);

      const job = createJob({
        outboxEventId,
        eventType: 'REMINDER_DUE',
        correlationId: 'reminder-correlation-1',
        payload: {
          to: 'reminder@example.com',
          taskTitle: 'Complete task',
          dueDate: dueDate.toISOString(),
          priority: 'high',
        },
      });

      await reminderProcessor.process(job);

      expect(sendReminderEmail).toHaveBeenCalledWith(
        'reminder@example.com',
        'Complete task',
        expect.any(Date),
        'high',
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery?.status).toBe(EmailDeliveryStatus.SENT);

      expect(delivery?.attempts).toBe(1);

      expect(
        await processedEventRepository.hasBeenProcessed(outboxEventId),
      ).toBe(true);
    });

    it('should skip an already processed reminder event', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createReminderDelivery(outboxEventId);

      await processedEventRepository.markProcessed(
        outboxEventId,
        'REMINDER_DUE',
      );

      const sendReminderEmail = jest
        .spyOn(mailService, 'sendReminderEmail')
        .mockResolvedValue(undefined);

      const job = createJob({
        outboxEventId,
        eventType: 'REMINDER_DUE',
        payload: {
          to: 'reminder@example.com',
          taskTitle: 'Complete task',
          dueDate: new Date().toISOString(),
          priority: 'high',
        },
      });

      await reminderProcessor.process(job);

      expect(sendReminderEmail).not.toHaveBeenCalled();
    });

    it('should reject a job with missing outboxEventId', async () => {
      const job = createJob({
        eventType: 'REMINDER_DUE',
        payload: {},
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Reminder job is missing outboxEventId',
      );
    });

    it('should reject a job with missing eventType', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        payload: {},
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Reminder job is missing eventType',
      );
    });

    it('should reject a job with missing payload', async () => {
      const job = createJob({
        outboxEventId: new Types.ObjectId().toString(),
        eventType: 'REMINDER_DUE',
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Reminder job is missing payload',
      );
    });

    it('should reject when email delivery record does not exist', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const job = createJob({
        outboxEventId,
        eventType: 'REMINDER_DUE',
        payload: {
          to: 'reminder@example.com',
          taskTitle: 'Complete task',
          dueDate: new Date().toISOString(),
          priority: 'high',
        },
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        `Email delivery record not found for outbox event ${outboxEventId}`,
      );
    });

    it('should reject an unsupported reminder event type', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createReminderDelivery(outboxEventId);

      const job = createJob({
        outboxEventId,
        eventType: 'UNSUPPORTED_REMINDER_EVENT',
        payload: {
          to: 'reminder@example.com',
          taskTitle: 'Complete task',
          dueDate: new Date().toISOString(),
          priority: 'high',
        },
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Unsupported reminder event type: UNSUPPORTED_REMINDER_EVENT',
      );
    });

    it('should reject an invalid REMINDER_DUE payload', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createReminderDelivery(outboxEventId);

      const job = createJob({
        outboxEventId,
        eventType: 'REMINDER_DUE',
        payload: {
          to: 'reminder@example.com',
          taskTitle: 'Complete task',
          priority: 'high',
        },
      });

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'REMINDER_DUE payload is invalid',
      );
    });

    it('should update delivery after a non-final failed attempt', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createReminderDelivery(outboxEventId);

      jest
        .spyOn(mailService, 'sendReminderEmail')
        .mockRejectedValue(new Error('Mail provider temporarily unavailable'));

      const moveToDeadLetterQueue = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue(undefined);

      const job = createJob(
        {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          payload: {
            to: 'reminder@example.com',
            taskTitle: 'Complete task',
            dueDate: new Date().toISOString(),
            priority: 'high',
          },
        },
        {
          attemptsMade: 0,
          attempts: 3,
        },
      );

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Mail provider temporarily unavailable',
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery?.attempts).toBe(1);

      expect(delivery?.lastError).toBe('Mail provider temporarily unavailable');

      expect(moveToDeadLetterQueue).not.toHaveBeenCalled();
    });

    it('should mark delivery as FAILED and move reminder to DLQ on final failure', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await createReminderDelivery(outboxEventId);

      jest
        .spyOn(mailService, 'sendReminderEmail')
        .mockRejectedValue(new Error('Reminder delivery failed'));

      const moveToDeadLetterQueue = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue(undefined);

      const job = createJob(
        {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'reminder-final-failure',
          payload: {
            to: 'reminder@example.com',
            taskTitle: 'Complete task',
            dueDate: new Date().toISOString(),
            priority: 'high',
          },
        },
        {
          attemptsMade: 0,
          attempts: 1,
        },
      );

      await expect(reminderProcessor.process(job)).rejects.toThrow(
        'Reminder delivery failed',
      );

      const delivery = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(outboxEventId),
      );

      expect(delivery?.status).toBe(EmailDeliveryStatus.FAILED);

      expect(delivery?.attempts).toBe(1);

      expect(delivery?.lastError).toBe('Reminder delivery failed');

      expect(delivery?.failedAt).toEqual(expect.any(Date));

      expect(moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: QUEUE_NAMES.REMINDER,
          jobId: job.id,
          outboxEventId,
          eventType: 'REMINDER_DUE',
          attempts: 1,
          error: 'Reminder delivery failed',
        }),
      );
    });
  });

  // ===========================================================================
  // Webhook Processor
  // ===========================================================================

  describe('WebhookProcessor', () => {
    const workspaceId = new Types.ObjectId().toString();

    function webhookJob(
      outboxEventId: string,
      overrides: Record<string, unknown> = {},
      options?: {
        attemptsMade?: number;
        attempts?: number;
      },
    ) {
      return createJob(
        {
          outboxEventId,
          workspaceId,
          eventType: 'TASK_CREATED',
          correlationId: 'webhook-correlation-1',
          payload: {
            taskId: new Types.ObjectId().toString(),
            title: 'Test task',
          },
          ...overrides,
        },
        options,
      );
    }

    it('should deliver a webhook successfully and mark the event processed', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const deliverToWorkspace = jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockResolvedValue(undefined);

      const job = webhookJob(outboxEventId);

      await webhookProcessor.process(job);

      expect(deliverToWorkspace).toHaveBeenCalledWith(
        workspaceId,
        outboxEventId,
        'TASK_CREATED',
        {
          taskId: expect.any(String),
          title: 'Test task',
        },
        1,
      );

      expect(
        await processedEventRepository.hasBeenProcessed(outboxEventId),
      ).toBe(true);
    });

    it('should skip an already processed webhook event', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      await processedEventRepository.markProcessed(
        outboxEventId,
        'TASK_CREATED',
      );

      const deliverToWorkspace = jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockResolvedValue(undefined);

      const job = webhookJob(outboxEventId);

      await webhookProcessor.process(job);

      expect(deliverToWorkspace).not.toHaveBeenCalled();
    });

    it('should reject a job with missing outboxEventId', async () => {
      const job = webhookJob('', {
        outboxEventId: undefined,
      });

      await expect(webhookProcessor.process(job)).rejects.toThrow(
        'Webhook job is missing outboxEventId',
      );
    });

    it('should reject a job with missing workspaceId', async () => {
      const job = webhookJob(new Types.ObjectId().toString(), {
        workspaceId: undefined,
      });

      await expect(webhookProcessor.process(job)).rejects.toThrow(
        'Webhook job is missing workspaceId',
      );
    });

    it('should reject a job with missing eventType', async () => {
      const job = webhookJob(new Types.ObjectId().toString(), {
        eventType: undefined,
      });

      await expect(webhookProcessor.process(job)).rejects.toThrow(
        'Webhook job is missing eventType',
      );
    });

    it('should reject a job with missing payload', async () => {
      const job = webhookJob(new Types.ObjectId().toString(), {
        payload: undefined,
      });

      await expect(webhookProcessor.process(job)).rejects.toThrow(
        'Webhook job is missing payload',
      );
    });

    it('should retry after a non-final webhook failure without moving to DLQ', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockRejectedValue(new Error('Webhook delivery temporarily failed'));

      const moveToDeadLetterQueue = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue(undefined);

      const job = webhookJob(
        outboxEventId,
        {},
        {
          attemptsMade: 0,
          attempts: 3,
        },
      );

      await expect(webhookProcessor.process(job)).rejects.toThrow(
        'Webhook delivery temporarily failed',
      );

      expect(moveToDeadLetterQueue).not.toHaveBeenCalled();

      expect(
        await processedEventRepository.hasBeenProcessed(outboxEventId),
      ).toBe(false);
    });

    it('should move webhook to DLQ on final failure', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      jest
        .spyOn(webhookService, 'deliverToWorkspace')
        .mockRejectedValue(new Error('Webhook delivery permanently failed'));

      const moveToDeadLetterQueue = jest
        .spyOn(deadLetterService, 'moveToDeadLetterQueue')
        .mockResolvedValue(undefined);

      const job = webhookJob(
        outboxEventId,
        {},
        {
          attemptsMade: 0,
          attempts: 1,
        },
      );

      await expect(webhookProcessor.process(job)).rejects.toThrow(
        'Webhook delivery permanently failed',
      );

      expect(moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: QUEUE_NAMES.WEBHOOK,
          jobId: job.id,
          outboxEventId,
          eventType: 'TASK_CREATED',
          attempts: 1,
          error: 'Webhook delivery permanently failed',
        }),
      );

      expect(
        await processedEventRepository.hasBeenProcessed(outboxEventId),
      ).toBe(false);
    });
  });
});
