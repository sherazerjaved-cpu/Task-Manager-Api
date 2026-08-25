import { Types } from 'mongoose';
import { CreateCommentHandler } from './create-comment.handler';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';

describe('CreateCommentHandler', () => {
  let handler: CreateCommentHandler;

  const taskRepository = {
    findAuthorizedTask: jest.fn(),
    addComment: jest.fn(),
    clearCache: jest.fn(),
  };

  const activityRepository = {
    create: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const taskId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const workspaceId = '507f1f77bcf86cd799439013';
  const role = 'MEMBER';

  const createCommentDto = {
    content: 'This is a test comment',
  };

  const task = {
    _id: new Types.ObjectId(taskId),
    workspace: new Types.ObjectId(workspaceId),
  };

  const updatedTask = {
    ...task,
    comments: [
      {
        user: new Types.ObjectId(userId),
        content: createCommentDto.content,
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();

    handler = new CreateCommentHandler(
      taskRepository as any,
      activityRepository as any,
      auditService as any,
    );
  });

  describe('execute', () => {
    it('should find the task using authorization information', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await handler.execute(command);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        role,
        workspaceId,
      );
    });

    it('should add the comment to the task', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await handler.execute(command);

      expect(taskRepository.addComment).toHaveBeenCalledWith(
        taskId,
        createCommentDto,
        userId,
      );
    });

    it('should create a COMMENT_ADDED activity', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await handler.execute(command);

      expect(activityRepository.create).toHaveBeenCalledWith({
        task: task._id,
        user: new Types.ObjectId(userId),
        action: ActivityAction.COMMENT_ADDED,
        description: 'Comment added',
      });
    });

    it('should create an audit log', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: userId,
        action: 'COMMENT_CREATED',
        resource: 'COMMENT',
        workspaceId,
        meta: {
          taskId,
        },
      });
    });

    it('should clear the task cache after creating the comment', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await handler.execute(command);

      expect(taskRepository.clearCache).toHaveBeenCalledTimes(1);
    });

    it('should return the updated task', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      const result = await handler.execute(command);

      expect(result).toBe(updatedTask);
    });

    it('should not add the comment when authorization fails', async () => {
      taskRepository.findAuthorizedTask.mockRejectedValue(
        new Error('Unauthorized'),
      );

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await expect(handler.execute(command)).rejects.toThrow('Unauthorized');

      expect(taskRepository.addComment).not.toHaveBeenCalled();
      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should not create activity or audit when adding the comment fails', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      taskRepository.addComment.mockRejectedValue(
        new Error('Failed to add comment'),
      );

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await expect(handler.execute(command)).rejects.toThrow(
        'Failed to add comment',
      );

      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate activity repository errors', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      activityRepository.create.mockRejectedValue(
        new Error('Activity unavailable'),
      );

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await expect(handler.execute(command)).rejects.toThrow(
        'Activity unavailable',
      );

      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate audit service errors', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await expect(handler.execute(command)).rejects.toThrow(
        'Audit unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should not clear cache when audit logging fails', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.addComment.mockResolvedValue(updatedTask);

      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      const command = {
        taskId,
        createCommentDto,
        userId,
        role,
        workspaceId,
      } as any;

      await expect(handler.execute(command)).rejects.toThrow();

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });
  });
});
