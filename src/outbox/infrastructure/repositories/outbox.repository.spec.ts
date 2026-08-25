import { Types } from 'mongoose';

import { OutboxRepository } from './outbox.repository';
import { OutboxEventStatus } from '../../domain/enums/outbox-event-status.enum';

describe('OutboxRepository', () => {
  let repository: OutboxRepository;

  let outboxModel: {
    find: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(() => {
    outboxModel = {
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
    };

    repository = new OutboxRepository(outboxModel as any);
  });

  describe('create', () => {
    it('should create an outbox event with PENDING status by default', async () => {
      const save = jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        eventType: 'TASK_CREATED',
        status: OutboxEventStatus.PENDING,
      });

      const MockModel = jest.fn().mockImplementation(() => ({
        save,
      }));

      repository = new OutboxRepository(MockModel as any);

      const aggregateId = new Types.ObjectId();
      const workspaceId = new Types.ObjectId();

      const data = {
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        workspaceId,
        correlationId: 'request-123',
        payload: {
          taskId: 'task-123',
        },
      };

      const result = await repository.create(data);

      expect(MockModel).toHaveBeenCalledWith({
        ...data,
        status: OutboxEventStatus.PENDING,
      });

      expect(save).toHaveBeenCalledWith({
        session: undefined,
      });

      expect(result).toEqual(
        expect.objectContaining({
          status: OutboxEventStatus.PENDING,
        }),
      );
    });

    it('should preserve an explicitly provided status', async () => {
      const save = jest.fn().mockResolvedValue({
        status: OutboxEventStatus.FAILED,
      });

      const MockModel = jest.fn().mockImplementation(() => ({
        save,
      }));

      repository = new OutboxRepository(MockModel as any);

      const data = {
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId: new Types.ObjectId(),
        payload: {},
        status: OutboxEventStatus.FAILED,
      };

      await repository.create(data);

      expect(MockModel).toHaveBeenCalledWith(data);
    });

    it('should pass the MongoDB session to save', async () => {
      const save = jest.fn().mockResolvedValue({});

      const MockModel = jest.fn().mockImplementation(() => ({
        save,
      }));

      repository = new OutboxRepository(MockModel as any);

      const session = {
        id: 'mock-session',
      };

      const data = {
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId: new Types.ObjectId(),
        payload: {},
      };

      await repository.create(data, session as any);

      expect(save).toHaveBeenCalledWith({
        session,
      });
    });

    it('should return the saved event', async () => {
      const savedEvent = {
        _id: new Types.ObjectId(),
        eventType: 'TASK_CREATED',
        status: OutboxEventStatus.PENDING,
      };

      const save = jest.fn().mockResolvedValue(savedEvent);

      const MockModel = jest.fn().mockImplementation(() => ({
        save,
      }));

      repository = new OutboxRepository(MockModel as any);

      const result = await repository.create({
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId: new Types.ObjectId(),
        payload: {},
      });

      expect(result).toBe(savedEvent);
    });
  });

  describe('findPending', () => {
    it('should find pending and retryable failed events', async () => {
      const exec = jest.fn().mockResolvedValue([]);

      const limit = jest.fn().mockReturnValue({
        exec,
      });

      const sort = jest.fn().mockReturnValue({
        limit,
      });

      outboxModel.find.mockReturnValue({
        sort,
      });

      const now = new Date();

      await repository.findPending(50, now);

      expect(outboxModel.find).toHaveBeenCalledWith({
        status: {
          $in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED],
        },
        $or: [
          {
            availableAt: {
              $exists: false,
            },
          },
          {
            availableAt: {
              $lte: now,
            },
          },
        ],
      });
    });

    it('should sort events by createdAt ascending', async () => {
      const exec = jest.fn().mockResolvedValue([]);

      const limit = jest.fn().mockReturnValue({
        exec,
      });

      const sort = jest.fn().mockReturnValue({
        limit,
      });

      outboxModel.find.mockReturnValue({
        sort,
      });

      await repository.findPending(25, new Date());

      expect(sort).toHaveBeenCalledWith({
        createdAt: 1,
      });
    });

    it('should apply the requested limit', async () => {
      const exec = jest.fn().mockResolvedValue([]);

      const limit = jest.fn().mockReturnValue({
        exec,
      });

      const sort = jest.fn().mockReturnValue({
        limit,
      });

      outboxModel.find.mockReturnValue({
        sort,
      });

      await repository.findPending(25, new Date());

      expect(limit).toHaveBeenCalledWith(25);
    });

    it('should return the repository query result', async () => {
      const events = [
        {
          _id: new Types.ObjectId(),
          eventType: 'TASK_CREATED',
        },
      ];

      const exec = jest.fn().mockResolvedValue(events);

      const limit = jest.fn().mockReturnValue({
        exec,
      });

      const sort = jest.fn().mockReturnValue({
        limit,
      });

      outboxModel.find.mockReturnValue({
        sort,
      });

      const result = await repository.findPending(10, new Date());

      expect(result).toBe(events);
    });
  });

  describe('markProcessing', () => {
    it('should move a pending event to PROCESSING', async () => {
      const result = {
        _id: new Types.ObjectId(),
        status: OutboxEventStatus.PROCESSING,
        attempts: 1,
      };

      outboxModel.findOneAndUpdate.mockResolvedValue(result);

      const id = new Types.ObjectId().toString();

      const response = await repository.markProcessing(id);

      expect(outboxModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: id,
          status: {
            $in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED],
          },
        },
        {
          $set: {
            status: OutboxEventStatus.PROCESSING,
          },
          $inc: {
            attempts: 1,
          },
        },
        {
          new: true,
        },
      );

      expect(response).toBe(result);
    });

    it('should allow FAILED events to be moved back to PROCESSING', async () => {
      outboxModel.findOneAndUpdate.mockResolvedValue(null);

      const id = new Types.ObjectId().toString();

      await repository.markProcessing(id);

      expect(outboxModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: {
            $in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED],
          },
        }),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should return null when no event can be moved to PROCESSING', async () => {
      outboxModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await repository.markProcessing(
        new Types.ObjectId().toString(),
      );

      expect(result).toBeNull();
    });
  });

  describe('markCompleted', () => {
    it('should mark a PROCESSING event as COMPLETED', async () => {
      const result = {
        _id: new Types.ObjectId(),
        status: OutboxEventStatus.COMPLETED,
      };

      outboxModel.findOneAndUpdate.mockResolvedValue(result);

      const id = new Types.ObjectId().toString();

      const response = await repository.markCompleted(id);

      expect(outboxModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: id,
          status: OutboxEventStatus.PROCESSING,
        },
        {
          $set: {
            status: OutboxEventStatus.COMPLETED,
            processedAt: expect.any(Date),
          },
        },
        {
          new: true,
        },
      );

      expect(response).toBe(result);
    });

    it('should return null when the event is not PROCESSING', async () => {
      outboxModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await repository.markCompleted(
        new Types.ObjectId().toString(),
      );

      expect(result).toBeNull();
    });
  });

  describe('markFailed', () => {
    it('should return null when the event does not exist', async () => {
      const id = new Types.ObjectId().toString();

      outboxModel.findById.mockResolvedValue(null);

      const result = await repository.markFailed(id, 'Redis unavailable');

      expect(outboxModel.findById).toHaveBeenCalledWith(id);

      expect(result).toBeNull();
    });

    it('should mark an event as FAILED when attempts are below the maximum', async () => {
      const id = new Types.ObjectId().toString();

      const event = {
        _id: id,
        attempts: 2,
      };

      const findByIdExec = jest.fn().mockResolvedValue(event);

      outboxModel.findById.mockReturnValue({
        exec: findByIdExec,
      });

      outboxModel.findOneAndUpdate.mockResolvedValue({
        ...event,
        status: OutboxEventStatus.FAILED,
      });

      const availableAt = new Date();

      await repository.markFailed(id, 'Webhook failed', availableAt);

      expect(outboxModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: id,
          status: OutboxEventStatus.PROCESSING,
        },
        {
          $set: {
            lastError: 'Webhook failed',
            status: OutboxEventStatus.FAILED,
            availableAt,
          },
        },
        {
          new: true,
        },
      );
    });

    it('should mark an event as FAILED without availableAt when no retry date is provided', async () => {
      const id = new Types.ObjectId().toString();

      const event = {
        _id: id,
        attempts: 2,
      };

      outboxModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(event),
      });

      outboxModel.findOneAndUpdate.mockResolvedValue(event);

      await repository.markFailed(id, 'Webhook failed');

      expect(outboxModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: id,
          status: OutboxEventStatus.PROCESSING,
        },
        {
          $set: {
            lastError: 'Webhook failed',
            status: OutboxEventStatus.FAILED,
          },
        },
        {
          new: true,
        },
      );
    });

    it('should remove availableAt when maximum attempts are reached', async () => {
      const id = new Types.ObjectId().toString();

      const event = {
        _id: id,
        attempts: 5,
      };

      outboxModel.findById.mockResolvedValue(event);

      outboxModel.findOneAndUpdate.mockResolvedValue({
        ...event,
        status: OutboxEventStatus.FAILED,
      });

      await repository.markFailed(id, 'Maximum attempts reached');

      expect(outboxModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: id,
          status: OutboxEventStatus.PROCESSING,
        },
        {
          $set: {
            lastError: 'Maximum attempts reached',
            status: OutboxEventStatus.FAILED,
            availableAt: undefined,
          },
          $unset: {
            availableAt: 1,
          },
        },
        {
          new: true,
        },
      );
    });

    it('should also remove availableAt when attempts exceed the maximum', async () => {
      const id = new Types.ObjectId().toString();

      const event = {
        _id: id,
        attempts: 6,
      };

      outboxModel.findById.mockResolvedValue(event);

      outboxModel.findOneAndUpdate.mockResolvedValue({
        ...event,
        status: OutboxEventStatus.FAILED,
      });

      await repository.markFailed(id, 'Too many attempts', new Date());

      expect(outboxModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: id,
          status: OutboxEventStatus.PROCESSING,
        },
        {
          $set: {
            lastError: 'Too many attempts',
            status: OutboxEventStatus.FAILED,
            availableAt: undefined,
          },
          $unset: {
            availableAt: 1,
          },
        },
        {
          new: true,
        },
      );
    });

    it('should return the updated event', async () => {
      const id = new Types.ObjectId().toString();

      const event = {
        _id: id,
        attempts: 1,
      };

      const updatedEvent = {
        ...event,
        status: OutboxEventStatus.FAILED,
      };

      outboxModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(event),
      });

      outboxModel.findOneAndUpdate.mockResolvedValue(updatedEvent);

      const result = await repository.markFailed(id, 'Something failed');

      expect(result).toBe(updatedEvent);
    });
  });
});
