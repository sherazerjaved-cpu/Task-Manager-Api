import { Queue } from 'bullmq';

import { DeadLetterService } from './dead-letter.service';

describe('DeadLetterService', () => {
  let service: DeadLetterService;

  let deadLetterQueue: {
    add: jest.Mock;
  };

  beforeEach(() => {
    deadLetterQueue = {
      add: jest.fn(),
    };

    service = new DeadLetterService(deadLetterQueue as unknown as Queue);
  });

  describe('moveToDeadLetterQueue', () => {
    it('should add a job to the DLQ with all supplied data', async () => {
      deadLetterQueue.add.mockResolvedValue(undefined);

      const data = {
        queueName: 'email',
        jobId: 'job-123',
        outboxEventId: 'outbox-123',
        eventType: 'EMAIL_REQUESTED',
        payload: {
          emailType: 'EMAIL_VERIFICATION',
          to: 'user@example.com',
          token: 'token-123',
        },
        error: 'SMTP connection failed',
        attempts: 3,
        correlationId: 'corr-123',
      };

      await service.moveToDeadLetterQueue(data);

      expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);

      expect(deadLetterQueue.add).toHaveBeenCalledWith(
        'dead-letter-job',
        {
          ...data,
          failedAt: expect.any(String),
        },
        {
          jobId: 'dlq-job-123',
        },
      );
    });

    it('should generate a valid ISO timestamp for failedAt', async () => {
      deadLetterQueue.add.mockResolvedValue(undefined);

      const before = Date.now();

      await service.moveToDeadLetterQueue({
        queueName: 'webhook',
        error: 'Webhook failed',
        attempts: 2,
      });

      const after = Date.now();

      const call = deadLetterQueue.add.mock.calls[0];

      const jobData = call[1];

      expect(jobData.failedAt).toEqual(expect.any(String));

      const failedAt = new Date(jobData.failedAt).getTime();

      expect(failedAt).toBeGreaterThanOrEqual(before);
      expect(failedAt).toBeLessThanOrEqual(after);
    });

    it('should not set a jobId when jobId is not provided', async () => {
      deadLetterQueue.add.mockResolvedValue(undefined);

      await service.moveToDeadLetterQueue({
        queueName: 'export',
        outboxEventId: 'outbox-456',
        eventType: 'EXPORT_REQUESTED',
        payload: {
          exportId: 'export-123',
        },
        error: 'Export failed',
        attempts: 3,
        correlationId: 'corr-456',
      });

      expect(deadLetterQueue.add).toHaveBeenCalledWith(
        'dead-letter-job',
        expect.objectContaining({
          queueName: 'export',
          outboxEventId: 'outbox-456',
          eventType: 'EXPORT_REQUESTED',
          payload: {
            exportId: 'export-123',
          },
          error: 'Export failed',
          attempts: 3,
          correlationId: 'corr-456',
          failedAt: expect.any(String),
        }),
        {
          jobId: undefined,
        },
      );
    });

    it('should preserve optional fields when they are provided', async () => {
      deadLetterQueue.add.mockResolvedValue(undefined);

      const payload = {
        taskId: 'task-123',
        title: 'Test task',
      };

      await service.moveToDeadLetterQueue({
        queueName: 'webhook',
        jobId: 'job-999',
        outboxEventId: 'outbox-999',
        eventType: 'TASK_CREATED',
        payload,
        error: 'Delivery failed',
        attempts: 5,
        correlationId: 'corr-999',
      });

      const jobData = deadLetterQueue.add.mock.calls[0][1];

      expect(jobData.queueName).toBe('webhook');
      expect(jobData.jobId).toBe('job-999');
      expect(jobData.outboxEventId).toBe('outbox-999');
      expect(jobData.eventType).toBe('TASK_CREATED');
      expect(jobData.payload).toEqual(payload);
      expect(jobData.error).toBe('Delivery failed');
      expect(jobData.attempts).toBe(5);
      expect(jobData.correlationId).toBe('corr-999');
      expect(jobData.failedAt).toEqual(expect.any(String));
    });

    it('should propagate queue errors', async () => {
      const queueError = new Error('Redis connection failed');

      deadLetterQueue.add.mockRejectedValue(queueError);

      await expect(
        service.moveToDeadLetterQueue({
          queueName: 'email',
          jobId: 'job-error',
          error: 'Email failed',
          attempts: 3,
        }),
      ).rejects.toThrow('Redis connection failed');

      expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should use the expected DLQ job name', async () => {
      deadLetterQueue.add.mockResolvedValue(undefined);

      await service.moveToDeadLetterQueue({
        queueName: 'reminder',
        error: 'Reminder failed',
        attempts: 1,
      });

      expect(deadLetterQueue.add.mock.calls[0][0]).toBe('dead-letter-job');
    });

    it('should prefix the original job ID with dlq-', async () => {
      deadLetterQueue.add.mockResolvedValue(undefined);

      await service.moveToDeadLetterQueue({
        queueName: 'webhook',
        jobId: 'abc-123',
        error: 'Webhook failed',
        attempts: 3,
      });

      const options = deadLetterQueue.add.mock.calls[0][2];

      expect(options).toEqual({
        jobId: 'dlq-abc-123',
      });
    });
  });
});
