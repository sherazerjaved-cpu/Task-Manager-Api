import { NotFoundException } from '@nestjs/common';
import { DeleteAttachmentHandler } from './delete-attachment.handler';
import { DeleteAttachmentCommand } from './delete-attachment.command';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';

describe('DeleteAttachmentHandler', () => {
  let handler: DeleteAttachmentHandler;

  const taskRepository = {
    findAuthorizedTask: jest.fn(),
    deleteAttachment: jest.fn(),
    clearCache: jest.fn(),
  };

  const activityRepository = {
    create: jest.fn(),
  };

  const fileStorageService = {
    deleteFile: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const taskId = '507f1f77bcf86cd799439011';
  const attachmentId = '507f1f77bcf86cd799439012';
  const userId = '507f1f77bcf86cd799439013';
  const workspaceId = '507f1f77bcf86cd799439014';
  const role = 'admin';

  const attachment = {
    _id: attachmentId,
    url: 'uploads/tasks/test-file.pdf',
  };

  const task = {
    _id: taskId,
    attachments: [attachment],
  };

  beforeEach(() => {
    jest.resetAllMocks();

    handler = new DeleteAttachmentHandler(
      taskRepository as any,
      activityRepository as any,
      fileStorageService as any,
      auditService as any,
    );
  });

  describe('execute', () => {
    const createCommand = () =>
      new DeleteAttachmentCommand(
        taskId,
        attachmentId,
        userId,
        role,
        workspaceId,
      );

    it('should find the task using authorization information', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        role,
        workspaceId,
      );
    });

    it('should throw NotFoundException when the attachment does not exist', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue({
        ...task,
        attachments: [],
      });

      await expect(handler.execute(createCommand())).rejects.toThrow(
        new NotFoundException('Attachment Not Found'),
      );

      expect(fileStorageService.deleteFile).not.toHaveBeenCalled();
      expect(taskRepository.deleteAttachment).not.toHaveBeenCalled();
      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should delete the file from storage', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(fileStorageService.deleteFile).toHaveBeenCalledWith(
        attachment.url,
      );
    });

    it('should delete the attachment from the task', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(taskRepository.deleteAttachment).toHaveBeenCalledWith(
        taskId,
        attachmentId,
      );
    });

    it('should create an ATTACHMENT_DELETED activity', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(activityRepository.create).toHaveBeenCalledWith({
        task: task._id,
        user: expect.anything(),
        action: ActivityAction.ATTACHMENT_DELETED,
        description: 'Attachment deleted',
      });
    });

    it('should create an audit log', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: userId,
        action: 'ATTACHMENT_DELETED',
        resource: 'ATTACHMENT',
        workspaceId,
        meta: {
          attachmentId,
          taskId,
        },
      });
    });

    it('should clear the task cache', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(taskRepository.clearCache).toHaveBeenCalledTimes(1);
    });

    it('should return a success message', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      const result = await handler.execute(createCommand());

      expect(result).toEqual({
        message: 'Attachment deleted successfully.',
      });
    });

    it('should not delete the database attachment when file deletion fails', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      fileStorageService.deleteFile.mockImplementation(() => {
        throw new Error('File storage unavailable');
      });

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'File storage unavailable',
      );

      expect(taskRepository.deleteAttachment).not.toHaveBeenCalled();
      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      taskRepository.deleteAttachment.mockRejectedValue(
        new Error('Database unavailable'),
      );

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Database unavailable',
      );

      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate activity repository errors', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      activityRepository.create.mockRejectedValue(
        new Error('Activity unavailable'),
      );

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Activity unavailable',
      );

      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate audit service errors', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Audit unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should not clear cache when audit logging fails', async () => {
      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Audit unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });
  });
});
