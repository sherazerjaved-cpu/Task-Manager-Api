import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { WebhookProcessor } from './webhook.processor';
import { WebhookService } from 'src/webhook/application/webhook.service';
import type { IProcessedEventRepository } from 'src/outbox/domain/repositories/processed-event.repository.interface';
import { DeadLetterService } from '../queues/dead-letter.service';
import { QUEUE_NAMES } from '../queues/queue.constants';

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;

  let logger: {
    info: jest.Mock;
    error: jest.Mock;
  };

  let webhookService: {
    deliverToWorkspace: jest.Mock;
  };

  let processedEventRepository: {
    hasBeenProcessed: jest.Mock;
    markProcessed: jest.Mock;
  };

  let deadLetterService: {
    moveToDeadLetterQueue: jest.Mock;
  };

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    webhookService = {
      deliverToWorkspace: jest.fn(),
    };

    processedEventRepository = {
      hasBeenProcessed: jest.fn(),
      markProcessed: jest.fn(),
    };

    deadLetterService = {
      moveToDeadLetterQueue: jest.fn(),
    };

    processor = new WebhookProcessor(
      logger as unknown as PinoLogger,
      webhookService as unknown as WebhookService,
      processedEventRepository as unknown as IProcessedEventRepository,
      deadLetterService as unknown as DeadLetterService,
    );
  });

  describe('process', () => {
    it('should process a webhook successfully', async () => {
      const job = {
        id: 'webhook-job-1',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-123',
          workspaceId: 'workspace-123',
          eventType: 'TASK_CREATED',
          correlationId: 'corr-123',
          payload: {
            taskId: 'task-123',
            title: 'Test task',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      webhookService.deliverToWorkspace.mockResolvedValue(undefined);

      processedEventRepository.markProcessed.mockResolvedValue(undefined);

      await processor.process(job);

      expect(processedEventRepository.hasBeenProcessed).toHaveBeenCalledWith(
        'outbox-123',
      );

      expect(webhookService.deliverToWorkspace).toHaveBeenCalledWith(
        'workspace-123',
        'outbox-123',
        'TASK_CREATED',
        {
          taskId: 'task-123',
          title: 'Test task',
        },
        1,
      );

      expect(processedEventRepository.markProcessed).toHaveBeenCalledWith(
        'outbox-123',
        'TASK_CREATED',
      );

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith(
        {
          jobId: 'webhook-job-1',
          queue: QUEUE_NAMES.WEBHOOK,
          correlationId: 'corr-123',
          outboxEventId: 'outbox-123',
        },
        'Webhook processed successfully',
      );
    });

    it('should pass the correct attempt number to the webhook service', async () => {
      const job = {
        id: 'webhook-job-2',
        attemptsMade: 2,
        opts: {
          attempts: 5,
        },
        data: {
          outboxEventId: 'outbox-attempt',
          workspaceId: 'workspace-attempt',
          eventType: 'TASK_UPDATED',
          correlationId: 'corr-attempt',
          payload: {
            taskId: 'task-attempt',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      await processor.process(job);

      expect(webhookService.deliverToWorkspace).toHaveBeenCalledWith(
        'workspace-attempt',
        'outbox-attempt',
        'TASK_UPDATED',
        {
          taskId: 'task-attempt',
        },
        3,
      );
    });

    it('should skip an already processed webhook event', async () => {
      const job = {
        id: 'webhook-job-3',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-processed',
          workspaceId: 'workspace-123',
          eventType: 'TASK_CREATED',
          correlationId: 'corr-processed',
          payload: {
            taskId: 'task-123',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(true);

      await processor.process(job);

      expect(processedEventRepository.hasBeenProcessed).toHaveBeenCalledWith(
        'outbox-processed',
      );

      expect(webhookService.deliverToWorkspace).not.toHaveBeenCalled();

      expect(processedEventRepository.markProcessed).not.toHaveBeenCalled();

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith(
        {
          jobId: 'webhook-job-3',
          queue: QUEUE_NAMES.WEBHOOK,
          correlationId: 'corr-processed',
          outboxEventId: 'outbox-processed',
        },
        'Skipping already processed webhook event',
      );
    });

    it('should throw when outboxEventId is missing', async () => {
      const job = {
        id: 'webhook-job-4',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          workspaceId: 'workspace-123',
          eventType: 'TASK_CREATED',
          payload: {
            taskId: 'task-123',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook job is missing outboxEventId',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();

      expect(webhookService.deliverToWorkspace).not.toHaveBeenCalled();
    });

    it('should throw when workspaceId is missing', async () => {
      const job = {
        id: 'webhook-job-5',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-123',
          eventType: 'TASK_CREATED',
          payload: {
            taskId: 'task-123',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook job is missing workspaceId',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();

      expect(webhookService.deliverToWorkspace).not.toHaveBeenCalled();
    });

    it('should throw when eventType is missing', async () => {
      const job = {
        id: 'webhook-job-6',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-123',
          workspaceId: 'workspace-123',
          payload: {
            taskId: 'task-123',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook job is missing eventType',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();

      expect(webhookService.deliverToWorkspace).not.toHaveBeenCalled();
    });

    it('should throw when payload is missing', async () => {
      const job = {
        id: 'webhook-job-7',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-123',
          workspaceId: 'workspace-123',
          eventType: 'TASK_CREATED',
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook job is missing payload',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();

      expect(webhookService.deliverToWorkspace).not.toHaveBeenCalled();
    });

    it('should retry when webhook delivery fails and attempts remain', async () => {
      const job = {
        id: 'webhook-job-8',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-retry',
          workspaceId: 'workspace-retry',
          eventType: 'TASK_CREATED',
          correlationId: 'corr-retry',
          payload: {
            taskId: 'task-retry',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      webhookService.deliverToWorkspace.mockRejectedValue(
        new Error('Webhook delivery failed'),
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook delivery failed',
      );

      expect(processedEventRepository.markProcessed).not.toHaveBeenCalled();

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      expect(logger.error).toHaveBeenCalledWith(
        {
          jobId: 'webhook-job-8',
          queue: QUEUE_NAMES.WEBHOOK,
          correlationId: 'corr-retry',
          outboxEventId: 'outbox-retry',
          attempt: 1,
          maxAttempts: 3,
          finalAttempt: false,
          err: expect.any(Error),
        },
        'Webhook job failed',
      );
    });

    it('should move webhook to DLQ on the final attempt', async () => {
      const job = {
        id: 'webhook-job-9',
        attemptsMade: 2,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-final',
          workspaceId: 'workspace-final',
          eventType: 'TASK_CREATED',
          correlationId: 'corr-final',
          payload: {
            taskId: 'task-final',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      webhookService.deliverToWorkspace.mockRejectedValue(
        new Error('Webhook permanently failed'),
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Webhook permanently failed',
      );

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.WEBHOOK,
        jobId: 'webhook-job-9',
        outboxEventId: 'outbox-final',
        eventType: 'TASK_CREATED',
        payload: {
          taskId: 'task-final',
        },
        error: 'Webhook permanently failed',
        attempts: 3,
        correlationId: 'corr-final',
      });

      expect(logger.error).toHaveBeenCalledWith(
        {
          jobId: 'webhook-job-9',
          queue: QUEUE_NAMES.WEBHOOK,
          correlationId: 'corr-final',
          outboxEventId: 'outbox-final',
        },
        'Webhook moved to DLQ',
      );
    });

    it('should use one attempt when job options do not specify attempts', async () => {
      const job = {
        id: 'webhook-job-10',
        attemptsMade: 0,
        opts: {},
        data: {
          outboxEventId: 'outbox-default',
          workspaceId: 'workspace-default',
          eventType: 'TASK_CREATED',
          correlationId: 'corr-default',
          payload: {
            taskId: 'task-default',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      webhookService.deliverToWorkspace.mockRejectedValue(
        new Error('Webhook failed'),
      );

      await expect(processor.process(job)).rejects.toThrow('Webhook failed');

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: QUEUE_NAMES.WEBHOOK,
          attempts: 1,
          error: 'Webhook failed',
        }),
      );
    });

    it('should handle a non-Error failure on the final attempt', async () => {
      const job = {
        id: 'webhook-job-11',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId: 'outbox-string-error',
          workspaceId: 'workspace-string-error',
          eventType: 'TASK_CREATED',
          correlationId: 'corr-string-error',
          payload: {
            taskId: 'task-string-error',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      webhookService.deliverToWorkspace.mockRejectedValue(
        'Webhook service failed',
      );

      await expect(processor.process(job)).rejects.toBe(
        'Webhook service failed',
      );

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.WEBHOOK,
        jobId: 'webhook-job-11',
        outboxEventId: 'outbox-string-error',
        eventType: 'TASK_CREATED',
        payload: {
          taskId: 'task-string-error',
        },
        error: 'Unknown webhook processing error',
        attempts: 1,
        correlationId: 'corr-string-error',
      });
    });

    it('should not mark the event as processed when delivery fails', async () => {
      const job = {
        id: 'webhook-job-12',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-failed',
          workspaceId: 'workspace-failed',
          eventType: 'TASK_CREATED',
          correlationId: 'corr-failed',
          payload: {
            taskId: 'task-failed',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      webhookService.deliverToWorkspace.mockRejectedValue(
        new Error('Delivery failed'),
      );

      await expect(processor.process(job)).rejects.toThrow('Delivery failed');

      expect(processedEventRepository.markProcessed).not.toHaveBeenCalled();
    });

    it('should mark the event as processed only after successful delivery', async () => {
      const job = {
        id: 'webhook-job-13',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-order',
          workspaceId: 'workspace-order',
          eventType: 'TASK_UPDATED',
          correlationId: 'corr-order',
          payload: {
            taskId: 'task-order',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      webhookService.deliverToWorkspace.mockResolvedValue(undefined);

      await processor.process(job);

      const deliverOrder =
        webhookService.deliverToWorkspace.mock.invocationCallOrder[0];

      const markProcessedOrder =
        processedEventRepository.markProcessed.mock.invocationCallOrder[0];

      expect(deliverOrder).toBeLessThan(markProcessedOrder);
    });
  });
});
