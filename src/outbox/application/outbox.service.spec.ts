import { Types } from 'mongoose';

import { OutboxService } from './outbox.service';
import { IOutboxRepository } from '../domain/repositories/outbox.repository.interface';
import { RequestContextService } from 'src/common/http/request-context.service';

describe('OutboxService', () => {
  let service: OutboxService;

  let outboxRepository: {
    create: jest.Mock;
    findPending: jest.Mock;
    markProcessing: jest.Mock;
    markCompleted: jest.Mock;
    markFailed: jest.Mock;
  };

  let requestContextService: {
    getRequestId: jest.Mock;
  };

  const aggregateId = '507f1f77bcf86cd799439011';
  const workspaceId = '507f1f77bcf86cd799439012';
  const eventId = '507f1f77bcf86cd799439013';

  beforeEach(() => {
    outboxRepository = {
      create: jest.fn(),
      findPending: jest.fn(),
      markProcessing: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };

    requestContextService = {
      getRequestId: jest.fn(),
    };

    service = new OutboxService(
      outboxRepository as unknown as IOutboxRepository,
      requestContextService as unknown as RequestContextService,
    );
  });

  describe('create', () => {
    it('should create an outbox event with the correct data', async () => {
      const correlationId = 'request-123';

      requestContextService.getRequestId.mockReturnValue(correlationId);

      const payload = {
        taskId: 'task-123',
        title: 'Test task',
      };

      const repositoryResult = {
        _id: new Types.ObjectId(eventId),
      };

      outboxRepository.create.mockResolvedValue(repositoryResult);

      const result = await service.create({
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        workspaceId,
        payload,
      });

      expect(result).toBe(repositoryResult);

      expect(requestContextService.getRequestId).toHaveBeenCalledTimes(1);

      expect(outboxRepository.create).toHaveBeenCalledWith(
        {
          eventType: 'TASK_CREATED',
          aggregateType: 'Task',
          aggregateId: expect.any(Types.ObjectId),
          workspaceId: expect.any(Types.ObjectId),
          correlationId,
          payload,
        },
        undefined,
      );

      const createdData = outboxRepository.create.mock.calls[0][0];

      expect(createdData.aggregateId.toString()).toBe(aggregateId);

      expect(createdData.workspaceId.toString()).toBe(workspaceId);
    });

    it('should convert aggregateId to a MongoDB ObjectId', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      outboxRepository.create.mockResolvedValue({});

      await service.create({
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        payload: {},
      });

      const createdData = outboxRepository.create.mock.calls[0][0];

      expect(createdData.aggregateId).toBeInstanceOf(Types.ObjectId);

      expect(createdData.aggregateId.toString()).toBe(aggregateId);
    });

    it('should convert workspaceId to a MongoDB ObjectId when provided', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      outboxRepository.create.mockResolvedValue({});

      await service.create({
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        workspaceId,
        payload: {},
      });

      const createdData = outboxRepository.create.mock.calls[0][0];

      expect(createdData.workspaceId).toBeInstanceOf(Types.ObjectId);

      expect(createdData.workspaceId.toString()).toBe(workspaceId);
    });

    it('should set workspaceId to undefined when it is not provided', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      outboxRepository.create.mockResolvedValue({});

      await service.create({
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        payload: {},
      });

      const createdData = outboxRepository.create.mock.calls[0][0];

      expect(createdData).toHaveProperty('workspaceId', undefined);
    });

    it('should preserve a provided event id', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      outboxRepository.create.mockResolvedValue({});

      await service.create({
        id: eventId,
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        payload: {},
      });

      const createdData = outboxRepository.create.mock.calls[0][0];

      expect(createdData._id).toBeInstanceOf(Types.ObjectId);

      expect(createdData._id.toString()).toBe(eventId);
    });

    it('should not include _id when an id is not provided', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      outboxRepository.create.mockResolvedValue({});

      await service.create({
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        payload: {},
      });

      const createdData = outboxRepository.create.mock.calls[0][0];

      expect(createdData).not.toHaveProperty('_id');
    });

    it('should include the correlation id from RequestContextService', async () => {
      requestContextService.getRequestId.mockReturnValue('correlation-456');

      outboxRepository.create.mockResolvedValue({});

      await service.create({
        eventType: 'TASK_COMPLETED',
        aggregateType: 'Task',
        aggregateId,
        payload: {
          taskId: 'task-123',
        },
      });

      const createdData = outboxRepository.create.mock.calls[0][0];

      expect(createdData.correlationId).toBe('correlation-456');
    });

    it('should pass the MongoDB session to the repository', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      outboxRepository.create.mockResolvedValue({});

      const session = {
        id: 'mock-session',
      };

      await service.create(
        {
          eventType: 'TASK_CREATED',
          aggregateType: 'Task',
          aggregateId,
          payload: {},
        },
        session as any,
      );

      expect(outboxRepository.create).toHaveBeenCalledWith(
        expect.any(Object),
        session,
      );
    });

    it('should preserve the event payload', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      outboxRepository.create.mockResolvedValue({});

      const payload = {
        taskId: 'task-123',
        title: 'Important task',
        priority: 'high',
        nested: {
          value: true,
        },
      };

      await service.create({
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        payload,
      });

      const createdData = outboxRepository.create.mock.calls[0][0];

      expect(createdData.payload).toBe(payload);
    });

    it('should return the repository result', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      const repositoryResult = {
        _id: new Types.ObjectId(),
        eventType: 'TASK_CREATED',
      };

      outboxRepository.create.mockResolvedValue(repositoryResult);

      const result = await service.create({
        eventType: 'TASK_CREATED',
        aggregateType: 'Task',
        aggregateId,
        payload: {},
      });

      expect(result).toBe(repositoryResult);
    });

    it('should propagate repository errors', async () => {
      requestContextService.getRequestId.mockReturnValue('request-123');

      outboxRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.create({
          eventType: 'TASK_CREATED',
          aggregateType: 'Task',
          aggregateId,
          payload: {},
        }),
      ).rejects.toThrow('Database error');
    });
  });

  describe('findPending', () => {
    it('should delegate to the repository', async () => {
      const now = new Date();
      const events = [{ eventType: 'TASK_CREATED' }];

      outboxRepository.findPending.mockResolvedValue(events);

      const result = await service.findPending(50, now);

      expect(outboxRepository.findPending).toHaveBeenCalledWith(50, now);

      expect(result).toBe(events);
    });
  });

  describe('markProcessing', () => {
    it('should delegate to the repository', async () => {
      const repositoryResult = {
        _id: new Types.ObjectId(),
        status: 'PROCESSING',
      };

      outboxRepository.markProcessing.mockResolvedValue(repositoryResult);

      const result = await service.markProcessing(eventId);

      expect(outboxRepository.markProcessing).toHaveBeenCalledWith(eventId);

      expect(result).toBe(repositoryResult);
    });
  });

  describe('markCompleted', () => {
    it('should delegate to the repository', async () => {
      const repositoryResult = {
        _id: new Types.ObjectId(),
        status: 'COMPLETED',
      };

      outboxRepository.markCompleted.mockResolvedValue(repositoryResult);

      const result = await service.markCompleted(eventId);

      expect(outboxRepository.markCompleted).toHaveBeenCalledWith(eventId);

      expect(result).toBe(repositoryResult);
    });
  });

  describe('markFailed', () => {
    it('should delegate to the repository with an available date', async () => {
      const availableAt = new Date();

      const repositoryResult = {
        _id: new Types.ObjectId(),
        status: 'FAILED',
      };

      outboxRepository.markFailed.mockResolvedValue(repositoryResult);

      const result = await service.markFailed(
        eventId,
        'Redis unavailable',
        availableAt,
      );

      expect(outboxRepository.markFailed).toHaveBeenCalledWith(
        eventId,
        'Redis unavailable',
        availableAt,
      );

      expect(result).toBe(repositoryResult);
    });

    it('should delegate to the repository without availableAt when omitted', async () => {
      outboxRepository.markFailed.mockResolvedValue(null);

      const result = await service.markFailed(eventId, 'Queue unavailable');

      expect(outboxRepository.markFailed).toHaveBeenCalledWith(
        eventId,
        'Queue unavailable',
        undefined,
      );

      expect(result).toBeNull();
    });
  });
});
