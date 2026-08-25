import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';

import { ReminderProcessor } from './reminder.processor';
import { MailService } from 'src/mail/mail.service';
import type { IProcessedEventRepository } from 'src/outbox/domain/repositories/processed-event.repository.interface';
import type { IEmailDeliveryRepository } from 'src/mail/domain/repositories/email-delivery.repository.interface';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';
import { DeadLetterService } from '../queues/dead-letter.service';
import { QUEUE_NAMES } from '../queues/queue.constants';

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;

  let logger: {
    info: jest.Mock;
    error: jest.Mock;
  };

  let mailService: {
    sendReminderEmail: jest.Mock;
  };

  let processedEventRepository: {
    hasBeenProcessed: jest.Mock;
    markProcessed: jest.Mock;
  };

  let emailDeliveryRepository: {
    findByOutboxEventId: jest.Mock;
    update: jest.Mock;
  };

  let deadLetterService: {
    moveToDeadLetterQueue: jest.Mock;
  };

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    mailService = {
      sendReminderEmail: jest.fn(),
    };

    processedEventRepository = {
      hasBeenProcessed: jest.fn(),
      markProcessed: jest.fn(),
    };

    emailDeliveryRepository = {
      findByOutboxEventId: jest.fn(),
      update: jest.fn(),
    };

    deadLetterService = {
      moveToDeadLetterQueue: jest.fn(),
    };

    processor = new ReminderProcessor(
      logger as unknown as PinoLogger,
      mailService as unknown as MailService,
      processedEventRepository as unknown as IProcessedEventRepository,
      emailDeliveryRepository as unknown as IEmailDeliveryRepository,
      deadLetterService as unknown as DeadLetterService,
    );
  });

  describe('process', () => {
    it('should process a reminder successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      const dueDate = '2026-08-25T10:00:00.000Z';

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      emailDeliveryRepository.update.mockResolvedValue(undefined);

      mailService.sendReminderEmail.mockResolvedValue(undefined);

      processedEventRepository.markProcessed.mockResolvedValue(undefined);

      const job = {
        id: 'reminder-job-1',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-123',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Finish testing',
            dueDate,
            priority: 'high',
          },
        },
      } as unknown as Job;

      await processor.process(job);

      expect(processedEventRepository.hasBeenProcessed).toHaveBeenCalledWith(
        outboxEventId,
      );

      expect(emailDeliveryRepository.findByOutboxEventId).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
      );

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        1,
        delivery._id.toString(),
        {
          status: EmailDeliveryStatus.SENDING,
          attempts: 1,
        },
      );

      expect(mailService.sendReminderEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Finish testing',
        new Date(dueDate),
        'high',
      );

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        2,
        delivery._id.toString(),
        {
          status: EmailDeliveryStatus.SENT,
          sentAt: expect.any(Date),
          lastError: undefined,
        },
      );

      expect(processedEventRepository.markProcessed).toHaveBeenCalledWith(
        outboxEventId,
        'REMINDER_DUE',
      );

      expect(logger.info).toHaveBeenCalledWith(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.REMINDER,
          correlationId: 'corr-123',
          outboxEventId,
        },
        'Reminder processed successfully',
      );

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();
    });

    it('should skip an already processed reminder event', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      processedEventRepository.hasBeenProcessed.mockResolvedValue(true);

      const job = {
        id: 'reminder-job-2',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-456',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Already sent',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'medium',
          },
        },
      } as unknown as Job;

      await processor.process(job);

      expect(processedEventRepository.hasBeenProcessed).toHaveBeenCalledWith(
        outboxEventId,
      );

      expect(
        emailDeliveryRepository.findByOutboxEventId,
      ).not.toHaveBeenCalled();

      expect(mailService.sendReminderEmail).not.toHaveBeenCalled();

      expect(processedEventRepository.markProcessed).not.toHaveBeenCalled();

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.REMINDER,
          correlationId: 'corr-456',
          outboxEventId,
        },
        'Skipping already processed reminder event',
      );
    });

    it('should throw when outboxEventId is missing', async () => {
      const job = {
        id: 'reminder-job-3',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-1',
          payload: {},
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Reminder job is missing outboxEventId',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();
    });

    it('should throw when eventType is missing', async () => {
      const job = {
        id: 'reminder-job-4',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-1',
          correlationId: 'corr-2',
          payload: {},
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Reminder job is missing eventType',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();
    });

    it('should throw when payload is missing', async () => {
      const job = {
        id: 'reminder-job-5',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-1',
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-3',
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Reminder job is missing payload',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();
    });

    it('should throw when the email delivery record does not exist', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(null);

      const job = {
        id: 'reminder-job-6',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-4',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Missing delivery',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'high',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        `Email delivery record not found for outbox event ${outboxEventId}`,
      );

      expect(mailService.sendReminderEmail).not.toHaveBeenCalled();

      expect(emailDeliveryRepository.update).not.toHaveBeenCalled();
    });

    it('should throw for an unsupported reminder event type', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'reminder-job-7',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId,
          eventType: 'UNKNOWN_EVENT',
          correlationId: 'corr-5',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Unsupported event',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'high',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Unsupported reminder event type: UNKNOWN_EVENT',
      );

      expect(emailDeliveryRepository.update).toHaveBeenCalledWith(
        expect.any(String),
        {
          status: EmailDeliveryStatus.FAILED,
          failedAt: expect.any(Date),
          lastError: 'Unsupported reminder event type: UNKNOWN_EVENT',
          attempts: 1,
        },
      );

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: QUEUE_NAMES.REMINDER,
          outboxEventId,
          eventType: 'UNKNOWN_EVENT',
          attempts: 1,
        }),
      );
    });

    it('should throw when reminder payload is invalid', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'reminder-job-8',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-invalid',
          payload: {
            to: 'user@example.com',
            taskTitle: 123,
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'high',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'REMINDER_DUE payload is invalid',
      );

      expect(mailService.sendReminderEmail).not.toHaveBeenCalled();

      expect(emailDeliveryRepository.update).toHaveBeenCalledWith(
        expect.any(String),
        {
          status: EmailDeliveryStatus.FAILED,
          failedAt: expect.any(Date),
          lastError: 'REMINDER_DUE payload is invalid',
          attempts: 1,
        },
      );
    });

    it('should throw when recipient is not a string', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'reminder-job-9',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-invalid-to',
          payload: {
            to: 123,
            taskTitle: 'Task',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'high',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'REMINDER_DUE payload is invalid',
      );

      expect(mailService.sendReminderEmail).not.toHaveBeenCalled();
    });

    it('should throw when taskTitle is not a string', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'reminder-job-10',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-invalid-title',
          payload: {
            to: 'user@example.com',
            taskTitle: 123,
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'high',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'REMINDER_DUE payload is invalid',
      );

      expect(mailService.sendReminderEmail).not.toHaveBeenCalled();
    });

    it('should throw when priority is not a string', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'reminder-job-11',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-invalid-priority',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Task',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 123,
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'REMINDER_DUE payload is invalid',
      );

      expect(mailService.sendReminderEmail).not.toHaveBeenCalled();
    });

    it('should throw when dueDate is missing', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'reminder-job-12',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-invalid-date',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Task',
            priority: 'high',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'REMINDER_DUE payload is invalid',
      );

      expect(mailService.sendReminderEmail).not.toHaveBeenCalled();
    });

    it('should retry when sending the reminder fails and attempts remain', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      mailService.sendReminderEmail.mockRejectedValue(
        new Error('SMTP temporarily unavailable'),
      );

      const job = {
        id: 'reminder-job-13',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-retry',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Retry reminder',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'medium',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'SMTP temporarily unavailable',
      );

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        1,
        delivery._id.toString(),
        {
          status: EmailDeliveryStatus.SENDING,
          attempts: 1,
        },
      );

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        2,
        delivery._id.toString(),
        {
          attempts: 1,
          lastError: 'SMTP temporarily unavailable',
        },
      );

      expect(processedEventRepository.markProcessed).not.toHaveBeenCalled();

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();
    });

    it('should mark delivery as FAILED and move to DLQ on final attempt', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      mailService.sendReminderEmail.mockRejectedValue(
        new Error('Reminder email permanently failed'),
      );

      const job = {
        id: 'reminder-job-14',
        attemptsMade: 2,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-final',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Final attempt',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'high',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Reminder email permanently failed',
      );

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        1,
        delivery._id.toString(),
        {
          status: EmailDeliveryStatus.SENDING,
          attempts: 3,
        },
      );

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        2,
        delivery._id.toString(),
        {
          status: EmailDeliveryStatus.FAILED,
          failedAt: expect.any(Date),
          lastError: 'Reminder email permanently failed',
          attempts: 3,
        },
      );

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.REMINDER,
        jobId: 'reminder-job-14',
        outboxEventId,
        eventType: 'REMINDER_DUE',
        payload: job.data.payload,
        error: 'Reminder email permanently failed',
        attempts: 3,
        correlationId: 'corr-final',
      });

      expect(logger.error).toHaveBeenCalledWith(
        {
          jobId: 'reminder-job-14',
          queue: QUEUE_NAMES.REMINDER,
          correlationId: 'corr-final',
          outboxEventId,
        },
        'Reminder permanently failed and moved to DLQ',
      );
    });

    it('should handle a non-Error failure on the final attempt', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      mailService.sendReminderEmail.mockRejectedValue('SMTP failure');

      const job = {
        id: 'reminder-job-15',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-string-error',
          payload: {
            to: 'user@example.com',
            taskTitle: 'String error',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'low',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toBe('SMTP failure');

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        2,
        delivery._id.toString(),
        {
          status: EmailDeliveryStatus.FAILED,
          failedAt: expect.any(Date),
          lastError: 'Unknown reminder processing error',
          attempts: 1,
        },
      );

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unknown reminder processing error',
          attempts: 1,
        }),
      );
    });

    it('should use one attempt when job options do not specify attempts', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      mailService.sendReminderEmail.mockRejectedValue(
        new Error('Reminder failed'),
      );

      const job = {
        id: 'reminder-job-16',
        attemptsMade: 0,
        opts: {},
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-default',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Default attempts',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'medium',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow('Reminder failed');

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: 1,
          error: 'Reminder failed',
        }),
      );
    });

    it('should not mark the event as processed when reminder sending fails', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      mailService.sendReminderEmail.mockRejectedValue(new Error('Send failed'));

      const job = {
        id: 'reminder-job-17',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId,
          eventType: 'REMINDER_DUE',
          correlationId: 'corr-not-processed',
          payload: {
            to: 'user@example.com',
            taskTitle: 'Failed reminder',
            dueDate: '2026-08-25T10:00:00.000Z',
            priority: 'high',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow('Send failed');

      expect(processedEventRepository.markProcessed).not.toHaveBeenCalled();
    });
  });
});
