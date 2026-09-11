import { Types } from 'mongoose';

import { GetAttachmentsHandler } from './get-attachments.handler';
import { GetAttachmentsQuery } from './get-attachments.query';

describe('GetAttachmentsHandler', () => {
  let handler: GetAttachmentsHandler;

  let taskRepository: {
    findAuthorizedTask: jest.Mock;
  };

  const taskId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId().toString();
  const role = 'MEMBER';

  const attachments = [
    {
      _id: new Types.ObjectId(),
      filename: 'document.pdf',
      url: 'uploads/document.pdf',
    },
    {
      _id: new Types.ObjectId(),
      filename: 'image.png',
      url: 'uploads/image.png',
    },
  ];

  const task = {
    _id: new Types.ObjectId(taskId),
    attachments,
  };

  const createQuery = (
    overrides: Partial<{
      taskId: string;
      userId: string;
      role: string;
      workspaceId: string;
    }> = {},
  ) =>
    new GetAttachmentsQuery(
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

    handler = new GetAttachmentsHandler(taskRepository as any);
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

    it('should return the task attachments', async () => {
      const query = createQuery();

      const result = await handler.execute(query);

      expect(result).toBe(attachments);
    });

    it('should return an empty array when the task has no attachments', async () => {
      const taskWithoutAttachments = {
        ...task,
        attachments: [],
      };

      taskRepository.findAuthorizedTask.mockResolvedValue(
        taskWithoutAttachments,
      );

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
    });

    it('should not return attachments when authorization fails', async () => {
      taskRepository.findAuthorizedTask.mockRejectedValue(
        new Error('Access denied'),
      );

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow('Access denied');

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledTimes(1);
    });

    it('should pass the correct task ID, user ID, role, and workspace ID', async () => {
      const customTaskId = new Types.ObjectId().toString();
      const customUserId = new Types.ObjectId().toString();
      const customWorkspaceId = new Types.ObjectId().toString();

      const query = createQuery({
        taskId: customTaskId,
        userId: customUserId,
        role: 'ADMIN',
        workspaceId: customWorkspaceId,
      });

      await handler.execute(query);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        customTaskId,
        customUserId,
        'ADMIN',
        customWorkspaceId,
      );
    });

    it('should not call the repository more than once', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledTimes(1);
    });
  });
});
