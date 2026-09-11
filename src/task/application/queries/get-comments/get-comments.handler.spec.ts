import { Types } from 'mongoose';

import { GetCommentsHandler } from './get-comments.handler';
import { GetCommentsQuery } from './get-comments.query';

describe('GetCommentsHandler', () => {
  let handler: GetCommentsHandler;

  let taskRepository: {
    findAuthorizedTask: jest.Mock;
    getComments: jest.Mock;
  };

  const taskId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId().toString();
  const role = 'MEMBER';

  const comments = [
    {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      text: 'First comment',
    },
    {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      text: 'Second comment',
    },
  ];

  const task = {
    _id: new Types.ObjectId(taskId),
  };

  const updatedTask = {
    _id: new Types.ObjectId(taskId),
    comments,
  };

  const createQuery = (
    overrides: Partial<{
      taskId: string;
      userId: string;
      role: string;
      workspaceId: string;
    }> = {},
  ) =>
    new GetCommentsQuery(
      overrides.taskId ?? taskId,
      overrides.userId ?? userId,
      overrides.role ?? role,
      overrides.workspaceId ?? workspaceId,
    );

  beforeEach(() => {
    jest.clearAllMocks();

    taskRepository = {
      findAuthorizedTask: jest.fn().mockResolvedValue(task),
      getComments: jest.fn().mockResolvedValue(updatedTask),
    };

    handler = new GetCommentsHandler(taskRepository as any);
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

    it('should get comments using the authorized task ID', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(taskRepository.getComments).toHaveBeenCalledTimes(1);

      expect(taskRepository.getComments).toHaveBeenCalledWith(taskId);
    });

    it('should return the task comments', async () => {
      const query = createQuery();

      const result = await handler.execute(query);

      expect(result).toBe(comments);
    });

    it('should return an empty array when the task has no comments', async () => {
      taskRepository.getComments.mockResolvedValue({
        ...updatedTask,
        comments: [],
      });

      const query = createQuery();

      const result = await handler.execute(query);

      expect(result).toEqual([]);
    });

    it('should propagate authorization errors', async () => {
      taskRepository.findAuthorizedTask.mockRejectedValue(
        new Error('Unauthorized'),
      );

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow('Unauthorized');

      expect(taskRepository.getComments).not.toHaveBeenCalled();
    });

    it('should propagate repository errors when getting comments', async () => {
      taskRepository.getComments.mockRejectedValue(
        new Error('Comments unavailable'),
      );

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow(
        'Comments unavailable',
      );
    });

    it('should pass the correct authorization information', async () => {
      const customTaskId = new Types.ObjectId().toString();
      const customUserId = new Types.ObjectId().toString();
      const customWorkspaceId = new Types.ObjectId().toString();

      const query = createQuery({
        taskId: customTaskId,
        userId: customUserId,
        role: 'ADMIN',
        workspaceId: customWorkspaceId,
      });

      taskRepository.findAuthorizedTask.mockResolvedValue({
        _id: new Types.ObjectId(customTaskId),
      });

      await handler.execute(query);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        customTaskId,
        customUserId,
        'ADMIN',
        customWorkspaceId,
      );
    });

    it('should use the authorized task ID when fetching comments', async () => {
      const authorizedTaskId = new Types.ObjectId();

      taskRepository.findAuthorizedTask.mockResolvedValue({
        _id: authorizedTaskId,
      });

      const query = createQuery();

      await handler.execute(query);

      expect(taskRepository.getComments).toHaveBeenCalledWith(
        authorizedTaskId.toString(),
      );
    });

    it('should execute operations in the correct order', async () => {
      const calls: string[] = [];

      taskRepository.findAuthorizedTask.mockImplementation(async () => {
        calls.push('authorize');

        return task;
      });

      taskRepository.getComments.mockImplementation(async () => {
        calls.push('getComments');

        return updatedTask;
      });

      const query = createQuery();

      await handler.execute(query);

      expect(calls).toEqual(['authorize', 'getComments']);
    });
  });
});
