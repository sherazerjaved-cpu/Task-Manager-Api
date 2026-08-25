import { PinoLogger } from 'nestjs-pino';
import { Job } from 'bullmq';

import { DeadLetterProcessor } from './dead-letter.processor';
import { QUEUE_NAMES } from '../queues/queue.constants';

describe('DeadLetterProcessor', () => {
  let processor: DeadLetterProcessor;

  let logger: {
    setContext: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
  };

  beforeEach(() => {
    logger = {
      setContext: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    processor = new DeadLetterProcessor(logger as unknown as PinoLogger);
  });

  describe('constructor', () => {
    it('should set the logger context to DeadLetterProcessor', () => {
      expect(logger.setContext).toHaveBeenCalledWith(DeadLetterProcessor.name);
    });
  });

  describe('process', () => {
    it('should log dead-letter job information', async () => {
      const job = {
        id: 'dlq-job-123',
        data: {
          queueName: 'email',
          jobId: 'original-job-456',
          outboxEventId: 'outbox-789',
          eventType: 'USER_REGISTERED',
          payload: {
            userId: 'user-123',
            email: 'test@example.com',
          },
          error: {
            message: 'Email delivery failed',
            stack: 'Error: Email delivery failed',
          },
          attempts: 3,
          failedAt: '2026-08-18T10:00:00.000Z',
          correlationId: 'corr-123',
        },
      } as unknown as Job;

      await processor.process(job);

      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);

      expect(logger.error).toHaveBeenNthCalledWith(
        1,
        {
          jobId: job.id,
          queue: QUEUE_NAMES.DLQ,
          sourceQueue: 'email',
          correlationId: 'corr-123',
          outboxEventId: 'outbox-789',
          eventType: 'USER_REGISTERED',
          attempts: 3,
          failedAt: '2026-08-18T10:00:00.000Z',
        },
        'Dead-letter job received',
      );

      expect(logger.error).toHaveBeenNthCalledWith(
        2,
        {
          jobId: job.id,
          queue: QUEUE_NAMES.DLQ,
          sourceQueue: 'email',
          correlationId: 'corr-123',
          outboxEventId: 'outbox-789',
          eventType: 'USER_REGISTERED',
          attempts: 3,
          failedAt: '2026-08-18T10:00:00.000Z',
          error: {
            message: 'Email delivery failed',
            stack: 'Error: Email delivery failed',
          },
        },
        'Dead-letter job details',
      );

      expect(logger.warn).toHaveBeenCalledWith(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.DLQ,
          correlationId: 'corr-123',
          payload: {
            userId: 'user-123',
            email: 'test@example.com',
          },
        },
        'Dead-letter job payload',
      );
    });

    it('should use the DLQ queue name in every log entry', async () => {
      const job = {
        id: 'dlq-job-123',
        data: {
          queueName: 'reminder',
          jobId: 'original-job-456',
          outboxEventId: 'outbox-789',
          eventType: 'REMINDER_TRIGGERED',
          payload: {},
          error: 'Something failed',
          attempts: 5,
          failedAt: '2026-08-18T11:00:00.000Z',
          correlationId: 'corr-456',
        },
      } as unknown as Job;

      await processor.process(job);

      expect(logger.error).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          queue: QUEUE_NAMES.DLQ,
        }),
        'Dead-letter job received',
      );

      expect(logger.error).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          queue: QUEUE_NAMES.DLQ,
        }),
        'Dead-letter job details',
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: QUEUE_NAMES.DLQ,
        }),
        'Dead-letter job payload',
      );
    });

    it('should handle missing optional job data', async () => {
      const job = {
        id: 'dlq-job-123',
        data: {},
      } as unknown as Job;

      await expect(processor.process(job)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);

      expect(logger.error).toHaveBeenNthCalledWith(
        1,
        {
          jobId: job.id,
          queue: QUEUE_NAMES.DLQ,
          sourceQueue: undefined,
          correlationId: undefined,
          outboxEventId: undefined,
          eventType: undefined,
          attempts: undefined,
          failedAt: undefined,
        },
        'Dead-letter job received',
      );

      expect(logger.error).toHaveBeenNthCalledWith(
        2,
        {
          jobId: job.id,
          queue: QUEUE_NAMES.DLQ,
          sourceQueue: undefined,
          correlationId: undefined,
          outboxEventId: undefined,
          eventType: undefined,
          attempts: undefined,
          failedAt: undefined,
          error: undefined,
        },
        'Dead-letter job details',
      );

      expect(logger.warn).toHaveBeenCalledWith(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.DLQ,
          correlationId: undefined,
          payload: undefined,
        },
        'Dead-letter job payload',
      );
    });
  });
});
