import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { CreateTaskHandler } from './create-task.handler';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';

describe('CreateTaskHandler', () => {
  let handler: CreateTaskHandler;

  const taskRepository = {
    create: jest.fn(),
    clearCache: jest.fn(),
  };

  const categoryRepository = {
    findById: jest.fn(),
  };

  const activityRepository = {
    create: jest.fn(),
  };

  const membershipRepository = {
    findByWorkspaceAndUser: jest.fn(),
  };

  const taskGateway = {
    emitTaskCreated: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const outboxService = {
    create: jest.fn(),
  };

  const session = {
    withTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  const connection = {
    startSession: jest.fn(),
  };

  const userId = '507f1f77bcf86cd799439011';
  const workspaceId = '507f1f77bcf86cd799439012';
  const categoryId = '507f1f77bcf86cd799439013';
  const taskId = new Types.ObjectId('507f1f77bcf86cd799439014');

  const createTaskDto = {
    title: 'Test task',
    description: 'Test description',
    workspaceId,
    category: categoryId,
  };

  const createdTask = {
    _id: taskId,
    owner: new Types.ObjectId(userId),
    title: 'Test task',
    workspace: new Types.ObjectId(workspaceId),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    connection.startSession.mockResolvedValue(session);

    session.withTransaction.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );

    session.endSession.mockResolvedValue(undefined);

    taskRepository.create.mockResolvedValue(createdTask);
    activityRepository.create.mockResolvedValue(undefined);
    outboxService.create.mockResolvedValue(undefined);
    auditService.log.mockResolvedValue(undefined);
    taskRepository.clearCache.mockResolvedValue(undefined);

    handler = new CreateTaskHandler(
      taskRepository as any,
      categoryRepository as any,
      activityRepository as any,
      membershipRepository as any,
      taskGateway as any,
      auditService as any,
      outboxService as any,
      connection as any,
    );
  });

  describe('execute', () => {
    it('should throw ForbiddenException when the user is not a workspace member', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const command = {
        createTaskDto,
        userId,
      } as any;

      await expect(handler.execute(command)).rejects.toThrow(
        new ForbiddenException('You are not a member of this workspace'),
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );

      expect(categoryRepository.findById).not.toHaveBeenCalled();
      expect(connection.startSession).not.toHaveBeenCalled();
      expect(taskRepository.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the category does not exist', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue(null);

      const command = {
        createTaskDto,
        userId,
      } as any;

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('Category not found'),
      );

      expect(categoryRepository.findById).toHaveBeenCalledWith(
        categoryId,
        userId,
      );

      expect(connection.startSession).not.toHaveBeenCalled();
      expect(taskRepository.create).not.toHaveBeenCalled();
    });

    it('should not check category when category is not provided', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      const dtoWithoutCategory = {
        title: 'Task without category',
        description: 'Description',
        workspaceId,
      };

      taskRepository.create.mockResolvedValue(createdTask);

      const command = {
        createTaskDto: dtoWithoutCategory,
        userId,
      } as any;

      const result = await handler.execute(command);

      expect(categoryRepository.findById).not.toHaveBeenCalled();

      expect(result).toBe(createdTask);
    });

    it('should verify workspace membership before creating the task', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );

      expect(taskRepository.create).toHaveBeenCalled();
    });

    it('should create a MongoDB session', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(connection.startSession).toHaveBeenCalledTimes(1);
    });

    it('should create the task inside a transaction', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(session.withTransaction).toHaveBeenCalledTimes(1);

      expect(taskRepository.create).toHaveBeenCalledWith(
        createTaskDto,
        userId,
        session,
      );
    });

    it('should create a CREATED activity inside the transaction', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(activityRepository.create).toHaveBeenCalledWith(
        {
          task: createdTask._id,
          user: new Types.ObjectId(userId),
          action: ActivityAction.CREATED,
          description: 'Task created',
        },
        session,
      );
    });

    it('should create a TASK_CREATED outbox event inside the transaction', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(outboxService.create).toHaveBeenCalledWith(
        {
          eventType: 'TASK_CREATED',
          aggregateType: 'TASK',
          aggregateId: createdTask._id.toString(),
          workspaceId,
          payload: {
            taskId: createdTask._id.toString(),
            ownerId: createdTask.owner.toString(),
            title: createdTask.title,
          },
        },
        session,
      );
    });

    it('should end the session after successful transaction', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should end the session when the transaction fails', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      session.withTransaction.mockRejectedValue(
        new Error('Transaction failed'),
      );

      await expect(
        handler.execute({
          createTaskDto,
          userId,
        } as any),
      ).rejects.toThrow('Transaction failed');

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should not create activity when task creation fails', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      taskRepository.create.mockRejectedValue(
        new Error('Task creation failed'),
      );

      await expect(
        handler.execute({
          createTaskDto,
          userId,
        } as any),
      ).rejects.toThrow('Task creation failed');

      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(outboxService.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskCreated).not.toHaveBeenCalled();
    });

    it('should not create outbox event when activity creation fails', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      activityRepository.create.mockRejectedValue(
        new Error('Activity creation failed'),
      );

      await expect(
        handler.execute({
          createTaskDto,
          userId,
        } as any),
      ).rejects.toThrow('Activity creation failed');

      expect(outboxService.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskCreated).not.toHaveBeenCalled();
    });

    it('should not create audit log when outbox creation fails', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      outboxService.create.mockRejectedValue(
        new Error('Outbox creation failed'),
      );

      await expect(
        handler.execute({
          createTaskDto,
          userId,
        } as any),
      ).rejects.toThrow('Outbox creation failed');

      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskCreated).not.toHaveBeenCalled();
    });

    it('should create an audit log after the transaction succeeds', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: userId,
        action: 'TASK_CREATED',
        resource: 'TASK',
        workspaceId,
        meta: {
          taskId: createdTask._id.toString(),
        },
      });
    });

    it('should clear the task cache after audit logging', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(taskRepository.clearCache).toHaveBeenCalledTimes(1);
    });

    it('should emit the task created event through the gateway', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(taskGateway.emitTaskCreated).toHaveBeenCalledWith(
        userId,
        createdTask,
      );
    });

    it('should return the created task', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      const result = await handler.execute({
        createTaskDto,
        userId,
      } as any);

      expect(result).toBe(createdTask);
    });

    it('should propagate audit errors', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      await expect(
        handler.execute({
          createTaskDto,
          userId,
        } as any),
      ).rejects.toThrow('Audit unavailable');

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskCreated).not.toHaveBeenCalled();
    });

    it('should propagate cache clearing errors', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      taskRepository.clearCache.mockRejectedValue(
        new Error('Cache unavailable'),
      );

      await expect(
        handler.execute({
          createTaskDto,
          userId,
        } as any),
      ).rejects.toThrow('Cache unavailable');

      expect(taskGateway.emitTaskCreated).not.toHaveBeenCalled();
    });

    it('should propagate gateway errors', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        userId,
        workspaceId,
      });

      categoryRepository.findById.mockResolvedValue({
        _id: categoryId,
      });

      taskGateway.emitTaskCreated.mockImplementation(() => {
        throw new Error('Gateway unavailable');
      });

      await expect(
        handler.execute({
          createTaskDto,
          userId,
        } as any),
      ).rejects.toThrow('Gateway unavailable');
    });
  });
});
