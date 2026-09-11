import { Types } from 'mongoose';

import { GetTaskByIdHandler } from './get-task-by-id.handler';
import { GetTaskByIdQuery } from './get-task-by-id.query';

describe('GetTaskByIdHandler', () => {
  let handler: GetTaskByIdHandler;

  let taskRepository: {
    findAuthorizedTask: jest.Mock;
  };

  const taskId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId().toString();
  const role = 'MEMBER';

  const task = {
    _id: new Types.ObjectId(taskId),
    title: 'Test task',
    description: 'Test description',
    status: 'pending',
    workspace: new Types.ObjectId(workspaceId),
    owner: new Types.ObjectId(userId),
  };

  const createQuery = (
    overrides: Partial<{
      taskId: string;
      userId: string;
      role: string;
      workspaceId: string;
    }> = {},
  ) =>
    new GetTaskByIdQuery(
      overrides.taskId ?? taskId,
      overrides.userId ?? userId,
      overrides.role ?? role,
      overrides.workspaceId ?? workspaceId,
    );

  beforeEach(() => {
    jest.clearAllMocks();

    taskRepository = {
      findAuthorizedTask: jest.fn().mockResolvedValue(task),
    };

    handler = new GetTaskByIdHandler(taskRepository as any);
  });

  describe('execute', () => {
    it('should find the task using authorization information', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledTimes(1);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        role,
        workspaceId,
      );
    });

    it('should return the authorized task', async () => {
      const query = createQuery();

      const result = await handler.execute(query);

      expect(result).toBe(task);
    });

    it('should propagate repository errors', async () => {
      taskRepository.findAuthorizedTask.mockRejectedValue(
        new Error('Task unavailable'),
      );

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow('Task unavailable');
    });

    it('should pass the correct task ID', async () => {
      const customTaskId = new Types.ObjectId().toString();

      const query = createQuery({
        taskId: customTaskId,
      });

      await handler.execute(query);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        customTaskId,
        userId,
        role,
        workspaceId,
      );
    });

    it('should pass the correct user ID', async () => {
      const customUserId = new Types.ObjectId().toString();

      const query = createQuery({
        userId: customUserId,
      });

      await handler.execute(query);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        customUserId,
        role,
        workspaceId,
      );
    });

    it('should pass the correct role', async () => {
      const query = createQuery({
        role: 'ADMIN',
      });

      await handler.execute(query);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        'ADMIN',
        workspaceId,
      );
    });

    it('should pass the correct workspace ID', async () => {
      const customWorkspaceId = new Types.ObjectId().toString();

      const query = createQuery({
        workspaceId: customWorkspaceId,
      });

      await handler.execute(query);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        role,
        customWorkspaceId,
      );
    });

    it('should propagate an authorization failure without modifying the error', async () => {
      const error = new Error('Access denied');

      taskRepository.findAuthorizedTask.mockRejectedValue(error);

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toBe(error);
    });
  });
});
