import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';

import { EmailProcessor } from './email.processor';
import { MailService } from 'src/mail/mail.service';
import { DeadLetterService } from '../queues/dead-letter.service';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';
import type { IEmailDeliveryRepository } from 'src/mail/domain/repositories/email-delivery.repository.interface';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
    error: jest.Mock;
  };

  let mailService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
    sendWorkspaceInvitation: jest.Mock;
    sendReminderEmail: jest.Mock;
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
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    mailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendWorkspaceInvitation: jest.fn(),
      sendReminderEmail: jest.fn(),
    };

    emailDeliveryRepository = {
      findByOutboxEventId: jest.fn(),
      update: jest.fn(),
    };

    deadLetterService = {
      moveToDeadLetterQueue: jest.fn(),
    };

    processor = new EmailProcessor(
      logger as unknown as PinoLogger,
      mailService as unknown as MailService,
      emailDeliveryRepository as unknown as IEmailDeliveryRepository,
      deadLetterService as unknown as DeadLetterService,
    );
  });

  describe('constructor', () => {
    it('should set the logger context', () => {
      expect(logger.setContext).toHaveBeenCalledWith(EmailProcessor.name);
    });
  });

  describe('process', () => {
    it('should process EMAIL_VERIFICATION successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      emailDeliveryRepository.update.mockResolvedValue(undefined);
      mailService.sendVerificationEmail.mockResolvedValue(undefined);

      const expiresAt = '2026-08-20T12:00:00.000Z';

      const job = {
        id: 'email-job-1',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          correlationId: 'corr-123',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'user@example.com',
            token: 'verification-token',
            expiresAt,
          },
        },
      } as unknown as Job;

      await processor.process(job);

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

      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        'user@example.com',
        'verification-token',
        new Date(expiresAt),
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

      expect(logger.info).toHaveBeenCalledWith(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.EMAIL,
          correlationId: 'corr-123',
        },
        'Email job processed successfully',
      );
    });

    it('should process PASSWORD_RESET successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      const expiresAt = '2026-08-21T12:00:00.000Z';

      const job = {
        id: 'email-job-2',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          correlationId: 'corr-reset',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'PASSWORD_RESET',
            to: 'user@example.com',
            token: 'reset-token',
            expiresAt,
          },
        },
      } as unknown as Job;

      await processor.process(job);

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        'reset-token',
        new Date(expiresAt),
      );
    });

    it('should process WORKSPACE_INVITATION successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const expiresAt = '2026-08-22T12:00:00.000Z';

      const job = {
        id: 'email-job-3',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          correlationId: 'corr-invite',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'WORKSPACE_INVITATION',
            to: 'member@example.com',
            workspaceName: 'Engineering',
            token: 'invite-token',
            expiresAt,
          },
        },
      } as unknown as Job;

      await processor.process(job);

      expect(mailService.sendWorkspaceInvitation).toHaveBeenCalledWith(
        'member@example.com',
        'Engineering',
        'invite-token',
        new Date(expiresAt),
      );
    });

    it('should process TASK_REMINDER successfully', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const dueDate = '2026-08-23T15:00:00.000Z';

      const job = {
        id: 'email-job-4',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          correlationId: 'corr-reminder',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'TASK_REMINDER',
            to: 'user@example.com',
            taskTitle: 'Finish testing',
            dueDate,
            priority: 'high',
          },
        },
      } as unknown as Job;

      await processor.process(job);

      expect(mailService.sendReminderEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Finish testing',
        new Date(dueDate),
        'high',
      );
    });

    it('should throw when eventType is missing', async () => {
      const job = {
        id: 'email-job-5',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          correlationId: 'corr-1',
          payload: {},
          outboxEventId: new Types.ObjectId().toString(),
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Email job is missing eventType',
      );

      expect(
        emailDeliveryRepository.findByOutboxEventId,
      ).not.toHaveBeenCalled();
    });

    it('should throw when payload is missing', async () => {
      const job = {
        id: 'email-job-6',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          correlationId: 'corr-2',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId: new Types.ObjectId().toString(),
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Email job is missing payload',
      );

      expect(
        emailDeliveryRepository.findByOutboxEventId,
      ).not.toHaveBeenCalled();
    });

    it('should throw when outboxEventId is missing', async () => {
      const job = {
        id: 'email-job-7',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          correlationId: 'corr-3',
          eventType: 'EMAIL_REQUESTED',
          payload: {},
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Email job is missing outboxEventId',
      );
    });

    it('should throw when delivery record is not found', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(null);

      const job = {
        id: 'email-job-8',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          correlationId: 'corr-4',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'user@example.com',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        `Email delivery record not found for outbox event ${outboxEventId}`,
      );

      expect(emailDeliveryRepository.update).not.toHaveBeenCalled();
    });

    it('should throw for an unsupported event type', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      const job = {
        id: 'email-job-9',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          correlationId: 'corr-5',
          eventType: 'UNKNOWN_EVENT',
          outboxEventId,
          payload: {},
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Unsupported email event type: UNKNOWN_EVENT',
      );

      expect(emailDeliveryRepository.update).toHaveBeenCalledWith(
        delivery._id.toString(),
        {
          status: EmailDeliveryStatus.SENDING,
          attempts: 1,
        },
      );
    });

    it('should move the job to DLQ on the final attempt', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      mailService.sendVerificationEmail.mockRejectedValue(
        new Error('SMTP server unavailable'),
      );

      const job = {
        id: 'email-job-10',
        attemptsMade: 2,
        opts: {
          attempts: 3,
        },
        data: {
          correlationId: 'corr-final',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'user@example.com',
            token: 'token',
            expiresAt: '2026-08-24T12:00:00.000Z',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'SMTP server unavailable',
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
          lastError: 'SMTP server unavailable',
          attempts: 3,
        },
      );

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.EMAIL,
        jobId: job.id,
        outboxEventId,
        eventType: 'EMAIL_REQUESTED',
        payload: job.data.payload,
        error: 'SMTP server unavailable',
        attempts: 3,
        correlationId: 'corr-final',
      });

      expect(logger.error).toHaveBeenCalledWith(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.EMAIL,
          correlationId: 'corr-final',
        },
        'Email permanently failed and moved to DLQ',
      );
    });

    it('should update the delivery but not move to DLQ when attempts remain', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      mailService.sendVerificationEmail.mockRejectedValue(
        new Error('Temporary SMTP error'),
      );

      const job = {
        id: 'email-job-11',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          correlationId: 'corr-retry',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'user@example.com',
            token: 'token',
            expiresAt: '2026-08-24T12:00:00.000Z',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Temporary SMTP error',
      );

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        2,
        delivery._id.toString(),
        {
          attempts: 1,
          lastError: 'Temporary SMTP error',
        },
      );

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();
    });

    it('should handle a non-Error failure', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      mailService.sendVerificationEmail.mockRejectedValue('SMTP failed');

      const job = {
        id: 'email-job-12',
        attemptsMade: 0,
        opts: {
          attempts: 2,
        },
        data: {
          correlationId: 'corr-string-error',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'user@example.com',
            token: 'token',
            expiresAt: '2026-08-24T12:00:00.000Z',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toBe('SMTP failed');

      expect(emailDeliveryRepository.update).toHaveBeenNthCalledWith(
        2,
        delivery._id.toString(),
        {
          attempts: 1,
          lastError: 'Unknown email processing error',
        },
      );

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();
    });

    it('should support missing job attempts configuration', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      const delivery = {
        _id: new Types.ObjectId(),
      };

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue(delivery);

      mailService.sendVerificationEmail.mockRejectedValue(
        new Error('SMTP failed'),
      );

      const job = {
        id: 'email-job-13',
        attemptsMade: 0,
        opts: {},
        data: {
          correlationId: 'corr-default-attempt',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 'user@example.com',
            token: 'token',
            expiresAt: '2026-08-24T12:00:00.000Z',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow('SMTP failed');

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: 1,
          error: 'SMTP failed',
        }),
      );
    });
  });

  describe('processEmailRequested', () => {
    it('should throw when emailType is invalid', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'email-job-14',
        attemptsMade: 0,
        opts: { attempts: 1 },
        data: {
          correlationId: 'corr-invalid-payload',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 123,
            to: 'user@example.com',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'EMAIL_REQUESTED payload is invalid',
      );
    });

    it('should throw when recipient is invalid', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'email-job-15',
        attemptsMade: 0,
        opts: { attempts: 1 },
        data: {
          correlationId: 'corr-invalid-to',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'EMAIL_VERIFICATION',
            to: 123,
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'EMAIL_REQUESTED payload is invalid',
      );
    });

    it('should throw for an unsupported email type', async () => {
      const outboxEventId = new Types.ObjectId().toString();

      emailDeliveryRepository.findByOutboxEventId.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const job = {
        id: 'email-job-16',
        attemptsMade: 0,
        opts: { attempts: 1 },
        data: {
          correlationId: 'corr-unsupported-email',
          eventType: 'EMAIL_REQUESTED',
          outboxEventId,
          payload: {
            emailType: 'UNKNOWN_EMAIL',
            to: 'user@example.com',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Unsupported email type: UNKNOWN_EMAIL',
      );
    });
  });
});
