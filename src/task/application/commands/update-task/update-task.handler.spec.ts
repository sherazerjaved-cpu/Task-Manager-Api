import { PreconditionFailedException, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Types } from 'mongoose';

import { UpdateTaskHandler } from './update-task.handler';
import { UpdateTaskCommand } from './update-task.command';

import { TaskStatus } from 'src/task/Enums/task-status.enum';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';
import { TaskCompletedEvent } from '../../events/task-completed.event';

describe('UpdateTaskHandler', () => {
  let handler: UpdateTaskHandler;

  let taskRepository: {
    findAuthorizedTask: jest.Mock;
    clearCache: jest.Mock;
  };

  let categoryRepository: {
    findByIdForRole: jest.Mock;
  };

  let activityRepository: {
    create: jest.Mock;
  };

  let taskGateway: {
    emitTaskUpdated: jest.Mock;
  };

  let eventBus: {
    publish: jest.Mock;
  };

  let auditService: {
    log: jest.Mock;
  };

  let connection: {
    startSession: jest.Mock;
  };

  let session: {
    withTransaction: jest.Mock;
    endSession: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();
  const taskId = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId().toString();
  const ownerId = new Types.ObjectId();

  let task: any;

  const createCommand = (
    overrides: Partial<{
      taskId: string;
      userId: string;
      role: string;
      workspaceId: string;
      expectedVersion: number;
      updateTaskDto: Record<string, any>;
    }> = {},
  ) =>
    new UpdateTaskCommand(
      overrides.taskId ?? taskId,
      overrides.updateTaskDto ?? {
        title: 'Updated task',
      },
      overrides.userId ?? userId,
      overrides.role ?? 'MEMBER',
      overrides.workspaceId ?? workspaceId,
      overrides.expectedVersion ?? 1,
    );

  beforeEach(() => {
    jest.resetAllMocks();

    taskRepository = {
      findAuthorizedTask: jest.fn(),
      clearCache: jest.fn().mockResolvedValue(undefined),
    };

    categoryRepository = {
      findByIdForRole: jest.fn(),
    };

    activityRepository = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    taskGateway = {
      emitTaskUpdated: jest.fn(),
    };

    eventBus = {
      publish: jest.fn(),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    session = {
      withTransaction: jest.fn(),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    connection = {
      startSession: jest.fn().mockResolvedValue(session),
    };

    task = {
      _id: new Types.ObjectId(taskId),
      owner: ownerId,
      title: 'Original task',
      description: 'Original description',
      status: TaskStatus.Pending,
      priority: 'medium',
      __v: 1,
      save: jest.fn().mockResolvedValue(undefined),
    };

    taskRepository.findAuthorizedTask.mockResolvedValue(task);

    session.withTransaction.mockImplementation(
      async (callback: () => Promise<any>) => callback(),
    );

    handler = new UpdateTaskHandler(
      taskRepository as any,
      categoryRepository as any,
      activityRepository as any,
      taskGateway as any,
      eventBus as unknown as EventBus,
      auditService as any,
      connection as any,
    );
  });

  describe('execute', () => {
    it('should update the task successfully', async () => {
      const command = createCommand({
        updateTaskDto: {
          title: 'Updated task',
        },
      });

      const result = await handler.execute(command);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        'MEMBER',
        workspaceId,
      );

      expect(task.title).toBe('Updated task');
      expect(task.save).toHaveBeenCalledWith({
        session,
      });

      expect(result).toBe(task);
    });

    it('should validate the category when one is provided', async () => {
      const categoryId = new Types.ObjectId().toString();

      categoryRepository.findByIdForRole.mockResolvedValue({
        _id: categoryId,
      });

      const command = createCommand({
        updateTaskDto: {
          category: categoryId,
        },
      });

      await handler.execute(command);

      expect(categoryRepository.findByIdForRole).toHaveBeenCalledWith(
        categoryId,
        userId,
        'MEMBER',
      );
    });

    it('should throw NotFoundException when the category does not exist', async () => {
      categoryRepository.findByIdForRole.mockResolvedValue(null);

      const command = createCommand({
        updateTaskDto: {
          category: new Types.ObjectId().toString(),
        },
      });

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);

      expect(taskRepository.findAuthorizedTask).not.toHaveBeenCalled();
      expect(connection.startSession).not.toHaveBeenCalled();
    });

    it('should find the task using authorization information', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        'MEMBER',
        workspaceId,
      );
    });

    it('should throw PreconditionFailedException when the version does not match', async () => {
      task.__v = 5;

      const command = createCommand({
        expectedVersion: 1,
      });

      await expect(handler.execute(command)).rejects.toThrow(
        PreconditionFailedException,
      );

      expect(task.save).not.toHaveBeenCalled();
      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(connection.startSession).not.toHaveBeenCalled();
    });

    it('should only assign defined update fields', async () => {
      const command = createCommand({
        updateTaskDto: {
          title: 'New title',
          description: undefined,
          priority: 'high',
        },
      });

      await handler.execute(command);

      expect(task.title).toBe('New title');
      expect(task.priority).toBe('high');
      expect(task.description).toBe('Original description');
    });

    it('should create an UPDATED activity when fields change', async () => {
      const command = createCommand({
        updateTaskDto: {
          title: 'New title',
          priority: 'high',
        },
      });

      await handler.execute(command);

      expect(activityRepository.create).toHaveBeenCalledTimes(1);

      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          task: task._id,
          user: new Types.ObjectId(userId),
          action: ActivityAction.UPDATED,
          description: 'Task updated',
          changes: expect.objectContaining({
            title: {
              old: 'Original task',
              new: 'New title',
            },
            priority: {
              old: 'medium',
              new: 'high',
            },
          }),
        }),
        session,
      );
    });

    it('should not create UPDATED activity when nothing changes', async () => {
      const command = createCommand({
        updateTaskDto: {
          title: 'Original task',
        },
      });

      await handler.execute(command);

      expect(activityRepository.create).not.toHaveBeenCalled();
    });

    it('should create TASK_UPDATED audit when fields change', async () => {
      const command = createCommand({
        updateTaskDto: {
          title: 'New title',
        },
      });

      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: userId,
          action: 'TASK_UPDATED',
          resource: 'TASK',
          workspaceId,
          meta: {
            taskId,
            changedFields: ['title'],
          },
        },
        session,
      );
    });

    it('should not create TASK_UPDATED audit when nothing changes', async () => {
      const command = createCommand({
        updateTaskDto: {
          title: 'Original task',
        },
      });

      await handler.execute(command);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should create TASK_COMPLETED audit when task becomes Done', async () => {
      task.status = TaskStatus.Pending;

      const command = createCommand({
        updateTaskDto: {
          status: TaskStatus.Done,
        },
      });

      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: userId,
          action: 'TASK_COMPLETED',
          resource: 'TASK',
          workspaceId,
          meta: {
            taskId,
          },
        },
        session,
      );
    });

    it('should publish TaskCompletedEvent when task becomes Done', async () => {
      task.status = TaskStatus.Pending;

      const command = createCommand({
        updateTaskDto: {
          status: TaskStatus.Done,
        },
      });

      await handler.execute(command);

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith(
        new TaskCompletedEvent(taskId, ownerId.toString()),
      );
    });

    it('should not publish TaskCompletedEvent when task was already Done', async () => {
      task.status = TaskStatus.Done;

      const command = createCommand({
        updateTaskDto: {
          status: TaskStatus.Done,
        },
      });

      await handler.execute(command);

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should clear task cache after successful update', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(taskRepository.clearCache).toHaveBeenCalledTimes(1);
    });

    it('should emit task updated through the gateway', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(taskGateway.emitTaskUpdated).toHaveBeenCalledWith(
        ownerId.toString(),
        task,
      );
    });

    it('should start a MongoDB session', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(connection.startSession).toHaveBeenCalledTimes(1);
    });

    it('should execute the update inside a transaction', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(session.withTransaction).toHaveBeenCalledTimes(1);
      expect(task.save).toHaveBeenCalledWith({
        session,
      });
    });

    it('should end the session after successful execution', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should end the session when the transaction fails', async () => {
      const error = new Error('Database unavailable');

      session.withTransaction.mockRejectedValue(error);

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Database unavailable',
      );

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should convert a VersionError from save into PreconditionFailedException', async () => {
      const versionError = new Error('Version conflict');
      versionError.name = 'VersionError';

      task.save.mockRejectedValue(versionError);

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        PreconditionFailedException,
      );

      expect(activityRepository.create).not.toHaveBeenCalled();
    });

    it('should propagate non-VersionError save errors', async () => {
      task.save.mockRejectedValue(new Error('Database unavailable'));

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Database unavailable',
      );

      expect(session.endSession).toHaveBeenCalled();
    });

    it('should propagate activity repository errors', async () => {
      activityRepository.create.mockRejectedValue(
        new Error('Activity unavailable'),
      );

      const command = createCommand({
        updateTaskDto: {
          title: 'New title',
        },
      });

      await expect(handler.execute(command)).rejects.toThrow(
        'Activity unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskUpdated).not.toHaveBeenCalled();
    });

    it('should propagate audit service errors', async () => {
      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      const command = createCommand({
        updateTaskDto: {
          title: 'New title',
        },
      });

      await expect(handler.execute(command)).rejects.toThrow(
        'Audit unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskUpdated).not.toHaveBeenCalled();
    });

    it('should propagate TASK_COMPLETED audit errors', async () => {
      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      const command = createCommand({
        updateTaskDto: {
          status: TaskStatus.Done,
        },
      });

      await expect(handler.execute(command)).rejects.toThrow(
        'Audit unavailable',
      );

      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should not clear cache when the transaction fails', async () => {
      task.save.mockRejectedValue(new Error('Database unavailable'));

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Database unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskUpdated).not.toHaveBeenCalled();
    });

    it('should not emit websocket event when the transaction fails', async () => {
      task.save.mockRejectedValue(new Error('Database unavailable'));

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Database unavailable',
      );

      expect(taskGateway.emitTaskUpdated).not.toHaveBeenCalled();
    });

    it('should return the updated task', async () => {
      const command = createCommand({
        updateTaskDto: {
          title: 'Updated title',
        },
      });

      const result = await handler.execute(command);

      expect(result).toBe(task);
    });
  });
});
