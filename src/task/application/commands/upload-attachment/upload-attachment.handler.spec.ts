import { Types } from 'mongoose';

import { UploadAttachmentHandler } from './upload-attachment.handler';
import { UploadAttachmentCommand } from './upload-attachment.command';

import { ActivityAction } from 'src/activity/enums/activity-action.enum';

describe('UploadAttachmentHandler', () => {
  let handler: UploadAttachmentHandler;

  let taskRepository: {
    findAuthorizedTask: jest.Mock;
    uploadAttachment: jest.Mock;
    clearCache: jest.Mock;
  };

  let activityRepository: {
    create: jest.Mock;
  };

  let auditService: {
    log: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();
  const taskId = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId().toString();

  const file = {
    fieldname: 'file',
    originalname: 'document.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test file'),
  } as Express.Multer.File;

  const attachmentId = new Types.ObjectId();

  let task: any;

  const createCommand = (
    overrides: Partial<{
      taskId: string;
      file: Express.Multer.File;
      userId: string;
      role: string;
      workspaceId: string;
    }> = {},
  ) =>
    new UploadAttachmentCommand(
      overrides.taskId ?? taskId,
      overrides.file ?? file,
      overrides.userId ?? userId,
      overrides.role ?? 'MEMBER',
      overrides.workspaceId ?? workspaceId,
    );

  beforeEach(() => {
    jest.resetAllMocks();

    taskRepository = {
      findAuthorizedTask: jest.fn(),
      uploadAttachment: jest.fn(),
      clearCache: jest.fn().mockResolvedValue(undefined),
    };

    activityRepository = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    task = {
      _id: new Types.ObjectId(taskId),
      attachments: [
        {
          _id: attachmentId,
          url: 'uploads/document.pdf',
          filename: 'document.pdf',
        },
      ],
    };

    taskRepository.findAuthorizedTask.mockResolvedValue(task);
    taskRepository.uploadAttachment.mockResolvedValue(task);

    handler = new UploadAttachmentHandler(
      taskRepository as any,
      activityRepository as any,
      auditService as any,
    );
  });

  describe('execute', () => {
    it('should verify that the user is authorized to access the task', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledTimes(1);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        'MEMBER',
        workspaceId,
      );
    });

    it('should upload the attachment to the task', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(taskRepository.uploadAttachment).toHaveBeenCalledTimes(1);

      expect(taskRepository.uploadAttachment).toHaveBeenCalledWith(
        taskId,
        file,
      );
    });

    it('should create an ATTACHMENT_ADDED activity', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(activityRepository.create).toHaveBeenCalledTimes(1);

      expect(activityRepository.create).toHaveBeenCalledWith({
        task: task._id,
        user: new Types.ObjectId(userId),
        action: ActivityAction.ATTACHMENT_ADDED,
        description: 'Attachment added',
      });
    });

    it('should create an audit log for the attachment', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledTimes(1);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: userId,
        action: 'ATTACHMENT_ADDED',
        resource: 'ATTACHMENT',
        workspaceId,
        meta: {
          attachmentId: attachmentId.toString(),
          taskId,
        },
      });
    });

    it('should clear the task cache after uploading the attachment', async () => {
      const command = createCommand();

      await handler.execute(command);

      expect(taskRepository.clearCache).toHaveBeenCalledTimes(1);
    });

    it('should return the task attachments', async () => {
      const command = createCommand();

      const result = await handler.execute(command);

      expect(result).toBe(task.attachments);
    });

    it('should use the latest attachment for the audit log', async () => {
      const firstAttachmentId = new Types.ObjectId();
      const secondAttachmentId = new Types.ObjectId();

      task.attachments = [
        {
          _id: firstAttachmentId,
          url: 'uploads/first.pdf',
        },
        {
          _id: secondAttachmentId,
          url: 'uploads/second.pdf',
        },
      ];

      taskRepository.uploadAttachment.mockResolvedValue(task);

      const command = createCommand();

      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            attachmentId: secondAttachmentId.toString(),
          }),
        }),
      );
    });

    it('should propagate authorization errors', async () => {
      taskRepository.findAuthorizedTask.mockRejectedValue(
        new Error('Unauthorized'),
      );

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow('Unauthorized');

      expect(taskRepository.uploadAttachment).not.toHaveBeenCalled();
      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      taskRepository.uploadAttachment.mockRejectedValue(
        new Error('Storage unavailable'),
      );

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Storage unavailable',
      );

      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate activity repository errors', async () => {
      activityRepository.create.mockRejectedValue(
        new Error('Activity unavailable'),
      );

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Activity unavailable',
      );

      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate audit service errors', async () => {
      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Audit unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should not clear cache when activity creation fails', async () => {
      activityRepository.create.mockRejectedValue(
        new Error('Activity unavailable'),
      );

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Activity unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should not clear cache when audit logging fails', async () => {
      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Audit unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should not create activity when attachment upload fails', async () => {
      taskRepository.uploadAttachment.mockRejectedValue(
        new Error('Upload failed'),
      );

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow('Upload failed');

      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate cache errors', async () => {
      taskRepository.clearCache.mockRejectedValue(
        new Error('Cache unavailable'),
      );

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(
        'Cache unavailable',
      );
    });

    it('should pass the correct user, role, and workspace to authorization', async () => {
      // These must be valid MongoDB ObjectId strings because
      // UploadAttachmentHandler converts userId to Types.ObjectId.
      const customUserId = new Types.ObjectId().toString();
      const customWorkspaceId = new Types.ObjectId().toString();

      const command = createCommand({
        userId: customUserId,
        role: 'ADMIN',
        workspaceId: customWorkspaceId,
      });

      await handler.execute(command);

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        customUserId,
        'ADMIN',
        customWorkspaceId,
      );
    });

    it('should pass the correct task ID and file to the repository', async () => {
      const customTaskId = new Types.ObjectId().toString();

      const command = createCommand({
        taskId: customTaskId,
      });

      await handler.execute(command);

      expect(taskRepository.uploadAttachment).toHaveBeenCalledWith(
        customTaskId,
        file,
      );
    });

    it('should execute operations in the correct order', async () => {
      const calls: string[] = [];

      taskRepository.findAuthorizedTask.mockImplementation(async () => {
        calls.push('authorize');
        return task;
      });

      taskRepository.uploadAttachment.mockImplementation(async () => {
        calls.push('upload');
        return task;
      });

      activityRepository.create.mockImplementation(async () => {
        calls.push('activity');
      });

      auditService.log.mockImplementation(async () => {
        calls.push('audit');
      });

      taskRepository.clearCache.mockImplementation(async () => {
        calls.push('cache');
      });

      const command = createCommand();

      await handler.execute(command);

      expect(calls).toEqual([
        'authorize',
        'upload',
        'activity',
        'audit',
        'cache',
      ]);
    });
  });
});
