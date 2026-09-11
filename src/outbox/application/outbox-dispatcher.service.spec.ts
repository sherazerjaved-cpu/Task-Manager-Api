import { Queue } from 'bullmq';

import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { IOutboxRepository } from '../domain/repositories/outbox.repository.interface';

describe('OutboxDispatcherService', () => {
  let service: OutboxDispatcherService;

  let outboxRepository: {
    findPending: jest.Mock;
    markProcessing: jest.Mock;
    markCompleted: jest.Mock;
    markFailed: jest.Mock;
  };

  let emailQueue: {
    add: jest.Mock;
  };

  let reminderQueue: {
    add: jest.Mock;
  };

  let webhookQueue: {
    add: jest.Mock;
  };

  let exportQueue: {
    add: jest.Mock;
  };

  const createEvent = (overrides: Partial<any> = {}) => ({
    _id: {
      toString: () => '507f1f77bcf86cd799439011',
    },
    eventType: 'EMAIL_REQUESTED',
    aggregateType: 'User',
    aggregateId: {
      toString: () => '507f1f77bcf86cd799439012',
    },
    workspaceId: {
      toString: () => '507f1f77bcf86cd799439013',
    },
    correlationId: 'correlation-123',
    payload: {
      emailType: 'EMAIL_VERIFICATION',
      to: 'user@example.com',
      token: 'token-123',
    },
    attempts: 0,
    ...overrides,
  });

  beforeEach(() => {
    outboxRepository = {
      findPending: jest.fn(),
      markProcessing: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };

    emailQueue = {
      add: jest.fn(),
    };

    reminderQueue = {
      add: jest.fn(),
    };

    webhookQueue = {
      add: jest.fn(),
    };

    exportQueue = {
      add: jest.fn(),
    };

    service = new OutboxDispatcherService(
      outboxRepository as unknown as IOutboxRepository,
      emailQueue as unknown as Queue,
      reminderQueue as unknown as Queue,
      webhookQueue as unknown as Queue,
      exportQueue as unknown as Queue,
    );
  });

  describe('dispatchPending', () => {
    it('should find pending events using the provided limit', async () => {
      outboxRepository.findPending.mockResolvedValue([]);

      await service.dispatchPending(25);

      expect(outboxRepository.findPending).toHaveBeenCalledWith(
        25,
        expect.any(Date),
      );
    });

    it('should use the default limit of 50', async () => {
      outboxRepository.findPending.mockResolvedValue([]);

      await service.dispatchPending();

      expect(outboxRepository.findPending).toHaveBeenCalledWith(
        50,
        expect.any(Date),
      );
    });

    it('should do nothing when there are no pending events', async () => {
      outboxRepository.findPending.mockResolvedValue([]);

      await service.dispatchPending();

      expect(outboxRepository.markProcessing).not.toHaveBeenCalled();

      expect(emailQueue.add).not.toHaveBeenCalled();
      expect(reminderQueue.add).not.toHaveBeenCalled();
      expect(webhookQueue.add).not.toHaveBeenCalled();
      expect(exportQueue.add).not.toHaveBeenCalled();
    });

    it('should mark an event as processing before dispatching it', async () => {
      const event = createEvent();

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);
      emailQueue.add.mockResolvedValue({});

      await service.dispatchPending();

      expect(outboxRepository.markProcessing).toHaveBeenCalledWith(
        event._id.toString(),
      );

      expect(emailQueue.add).toHaveBeenCalled();
    });

    it('should skip an event when markProcessing returns null', async () => {
      const event = createEvent();

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(null);

      await service.dispatchPending();

      expect(emailQueue.add).not.toHaveBeenCalled();

      expect(outboxRepository.markCompleted).not.toHaveBeenCalled();

      expect(outboxRepository.markFailed).not.toHaveBeenCalled();
    });

    describe('queue routing', () => {
      it.each([
        ['TASK_CREATED', 'webhookQueue'],
        ['TASK_COMPLETED', 'webhookQueue'],
        ['TASK_ASSIGNED', 'webhookQueue'],
        ['REMINDER_DUE', 'reminderQueue'],
        ['EMAIL_REQUESTED', 'emailQueue'],
        ['EXPORT_REQUESTED', 'exportQueue'],
      ])(
        'should route %s to the correct queue',
        async (eventType, expectedQueueName) => {
          const event = createEvent({
            eventType,
          });

          outboxRepository.findPending.mockResolvedValue([event]);
          outboxRepository.markProcessing.mockResolvedValue(event);

          emailQueue.add.mockResolvedValue({});
          reminderQueue.add.mockResolvedValue({});
          webhookQueue.add.mockResolvedValue({});
          exportQueue.add.mockResolvedValue({});

          await service.dispatchPending();

          const queues = {
            emailQueue,
            reminderQueue,
            webhookQueue,
            exportQueue,
          };

          expect(
            queues[expectedQueueName as keyof typeof queues].add,
          ).toHaveBeenCalledTimes(1);

          for (const [name, queue] of Object.entries(queues)) {
            if (name !== expectedQueueName) {
              expect(queue.add).not.toHaveBeenCalled();
            }
          }
        },
      );
    });

    it('should add an EMAIL_REQUESTED job with the correct payload', async () => {
      const event = createEvent({
        eventType: 'EMAIL_REQUESTED',
      });

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);
      emailQueue.add.mockResolvedValue({});

      await service.dispatchPending();

      expect(emailQueue.add).toHaveBeenCalledWith(
        'EMAIL_REQUESTED',
        {
          outboxEventId: '507f1f77bcf86cd799439011',
          eventType: 'EMAIL_REQUESTED',
          aggregateType: 'User',
          aggregateId: '507f1f77bcf86cd799439012',
          workspaceId: '507f1f77bcf86cd799439013',
          correlationId: 'correlation-123',
          payload: event.payload,
        },
        expect.objectContaining({
          jobId: '507f1f77bcf86cd799439011',
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        }),
      );
    });

    it('should add a REMINDER_DUE job to the reminder queue', async () => {
      const event = createEvent({
        eventType: 'REMINDER_DUE',
      });

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);
      reminderQueue.add.mockResolvedValue({});

      await service.dispatchPending();

      expect(reminderQueue.add).toHaveBeenCalledWith(
        'REMINDER_DUE',
        expect.objectContaining({
          outboxEventId: event._id.toString(),
          eventType: 'REMINDER_DUE',
          correlationId: event.correlationId,
          payload: event.payload,
        }),
        expect.objectContaining({
          jobId: event._id.toString(),
          attempts: 3,
        }),
      );
    });

    it('should add a webhook event to the webhook queue', async () => {
      const event = createEvent({
        eventType: 'TASK_CREATED',
      });

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);
      webhookQueue.add.mockResolvedValue({});

      await service.dispatchPending();

      expect(webhookQueue.add).toHaveBeenCalledWith(
        'TASK_CREATED',
        expect.objectContaining({
          outboxEventId: event._id.toString(),
          eventType: 'TASK_CREATED',
          correlationId: event.correlationId,
          payload: event.payload,
        }),
        expect.objectContaining({
          jobId: event._id.toString(),
          attempts: 3,
        }),
      );
    });

    it('should add an EXPORT_REQUESTED job to the export queue', async () => {
      const event = createEvent({
        eventType: 'EXPORT_REQUESTED',
      });

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);
      exportQueue.add.mockResolvedValue({});

      await service.dispatchPending();

      expect(exportQueue.add).toHaveBeenCalledWith(
        'EXPORT_REQUESTED',
        expect.objectContaining({
          outboxEventId: event._id.toString(),
          eventType: 'EXPORT_REQUESTED',
          correlationId: event.correlationId,
          payload: event.payload,
        }),
        expect.objectContaining({
          jobId: event._id.toString(),
          attempts: 3,
        }),
      );
    });

    it('should mark the event as completed after successful dispatch', async () => {
      const event = createEvent();

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);
      emailQueue.add.mockResolvedValue({});

      await service.dispatchPending();

      expect(outboxRepository.markCompleted).toHaveBeenCalledWith(
        event._id.toString(),
      );

      expect(outboxRepository.markFailed).not.toHaveBeenCalled();
    });

    it('should not mark the event as completed when queue.add fails', async () => {
      const event = createEvent();

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);

      emailQueue.add.mockRejectedValue(new Error('Redis unavailable'));

      await service.dispatchPending();

      expect(outboxRepository.markCompleted).not.toHaveBeenCalled();
    });

    it('should mark the event as failed when queue dispatch fails', async () => {
      const event = createEvent();

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);

      emailQueue.add.mockRejectedValue(new Error('Redis unavailable'));

      await service.dispatchPending();

      expect(outboxRepository.markFailed).toHaveBeenCalledWith(
        event._id.toString(),
        'Redis unavailable',
        expect.any(Date),
      );
    });

    it('should handle a non-Error failure when dispatching', async () => {
      const event = createEvent();

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);

      emailQueue.add.mockRejectedValue('Redis connection failed');

      await service.dispatchPending();

      expect(outboxRepository.markFailed).toHaveBeenCalledWith(
        event._id.toString(),
        'Redis connection failed',
        expect.any(Date),
      );
    });

    it('should calculate the retry delay based on the attempt count', async () => {
      const event = createEvent({
        attempts: 2,
      });

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);

      emailQueue.add.mockRejectedValue(new Error('Redis unavailable'));

      const before = Date.now();

      await service.dispatchPending();

      const after = Date.now();

      const failedCall = outboxRepository.markFailed.mock.calls[0];

      const retryAt = failedCall[2] as Date;

      const expectedDelay = 1000 * 2 ** 2;

      expect(retryAt.getTime()).toBeGreaterThanOrEqual(before + expectedDelay);

      expect(retryAt.getTime()).toBeLessThanOrEqual(after + expectedDelay);
    });

    it('should cap the retry delay at 30 seconds', async () => {
      const event = createEvent({
        attempts: 10,
      });

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);

      emailQueue.add.mockRejectedValue(new Error('Redis unavailable'));

      const before = Date.now();

      await service.dispatchPending();

      const after = Date.now();

      const retryAt = outboxRepository.markFailed.mock.calls[0][2] as Date;

      const expectedDelay = 30_000;

      expect(retryAt.getTime()).toBeGreaterThanOrEqual(before + expectedDelay);

      expect(retryAt.getTime()).toBeLessThanOrEqual(after + expectedDelay);
    });

    it('should continue processing other events when one event fails', async () => {
      const firstEvent = createEvent({
        _id: {
          toString: () => 'event-1',
        },
        eventType: 'EMAIL_REQUESTED',
      });

      const secondEvent = createEvent({
        _id: {
          toString: () => 'event-2',
        },
        eventType: 'REMINDER_DUE',
      });

      outboxRepository.findPending.mockResolvedValue([firstEvent, secondEvent]);

      outboxRepository.markProcessing
        .mockResolvedValueOnce(firstEvent)
        .mockResolvedValueOnce(secondEvent);

      emailQueue.add.mockRejectedValueOnce(new Error('Email queue failed'));

      reminderQueue.add.mockResolvedValueOnce({});

      await service.dispatchPending();

      expect(outboxRepository.markFailed).toHaveBeenCalledWith(
        'event-1',
        'Email queue failed',
        expect.any(Date),
      );

      expect(outboxRepository.markCompleted).toHaveBeenCalledWith('event-2');

      expect(reminderQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should handle an unsupported event type', async () => {
      const event = createEvent({
        eventType: 'UNKNOWN_EVENT',
      });

      outboxRepository.findPending.mockResolvedValue([event]);
      outboxRepository.markProcessing.mockResolvedValue(event);

      await service.dispatchPending();

      expect(outboxRepository.markFailed).toHaveBeenCalledWith(
        event._id.toString(),
        'No queue configured for event type: UNKNOWN_EVENT',
        expect.any(Date),
      );

      expect(outboxRepository.markCompleted).not.toHaveBeenCalled();

      expect(emailQueue.add).not.toHaveBeenCalled();
      expect(reminderQueue.add).not.toHaveBeenCalled();
      expect(webhookQueue.add).not.toHaveBeenCalled();
      expect(exportQueue.add).not.toHaveBeenCalled();
    });

    it('should dispatch multiple events', async () => {
      const emailEvent = createEvent({
        eventType: 'EMAIL_REQUESTED',
      });

      const webhookEvent = createEvent({
        _id: {
          toString: () => '507f1f77bcf86cd799439099',
        },
        eventType: 'TASK_CREATED',
      });

      outboxRepository.findPending.mockResolvedValue([
        emailEvent,
        webhookEvent,
      ]);

      outboxRepository.markProcessing
        .mockResolvedValueOnce(emailEvent)
        .mockResolvedValueOnce(webhookEvent);

      emailQueue.add.mockResolvedValue({});
      webhookQueue.add.mockResolvedValue({});

      await service.dispatchPending();

      expect(emailQueue.add).toHaveBeenCalledTimes(1);
      expect(webhookQueue.add).toHaveBeenCalledTimes(1);

      expect(outboxRepository.markCompleted).toHaveBeenCalledTimes(2);
    });
  });
});
