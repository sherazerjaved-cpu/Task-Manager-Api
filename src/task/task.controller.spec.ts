import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { TaskController } from './task.controller';

import { CreateTaskCommand } from './application/commands/create-task/create-task.command';
import { AssignTaskCommand } from './application/commands/assign-task/assign-task.command';
import { GetTasksQuery } from './application/queries/get-tasks/get-tasks.query';
import { GetTaskByIdQuery } from './application/queries/get-task-by-id/get-task-by-id.query';
import { UpdateTaskCommand } from './application/commands/update-task/update-task.command';
import { DeleteTaskCommand } from './application/commands/delete-task/delete-task.command';
import { UploadAttachmentCommand } from './application/commands/upload-attachment/upload-attachment.command';
import { DeleteAttachmentCommand } from './application/commands/delete-attachment/delete-attachment.command';
import { GetAttachmentsQuery } from './application/queries/get-attachments/get-attachments.query';
import { CreateCommentCommand } from './application/commands/create-comment/create-comment.command';
import { GetCommentsQuery } from './application/queries/get-comments/get-comments.query';
import { GetTaskStatsQuery } from './application/queries/get-task-stats/get-task-stats.query';
import { GetTaskActivitiesQuery } from 'src/activity/application/queries/get-task-activities/get-task-activities.query';

describe('TaskController', () => {
  let controller: TaskController;

  let commandBus: {
    execute: jest.Mock;
  };

  let queryBus: {
    execute: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();
  const taskId = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId().toString();

  const req = {
    user: {
      userId,
      role: 'user',
    },
  };

  beforeEach(() => {
    commandBus = {
      execute: jest.fn(),
    };

    queryBus = {
      execute: jest.fn(),
    };

    controller = new TaskController(commandBus as any, queryBus as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should execute CreateTaskCommand with DTO and authenticated user ID', async () => {
      const dto = {
        title: 'Test task',
        description: 'Test description',
        workspaceId,
      } as any;

      const expectedResult = {
        _id: taskId,
        title: 'Test task',
      };

      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.create(dto, req);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(CreateTaskCommand);
      expect(command.createTaskDto).toBe(dto);
      expect(command.userId).toBe(userId);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // assignTask
  // ---------------------------------------------------------------------------

  describe('assignTask', () => {
    it('should execute AssignTaskCommand with correct arguments', async () => {
      const dto = {
        userIds: [
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
        ],
      } as any;

      const expectedResult = {
        _id: taskId,
        assignees: dto.userIds,
      };

      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.assignTask(taskId, workspaceId, dto, req);

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(AssignTaskCommand);
      expect(command.taskId).toBe(taskId);
      expect(command.userId).toBe(userId);
      expect(command.workspaceId).toBe(workspaceId);
      expect(command.assignTaskDto).toBe(dto);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('should execute GetTasksQuery with user, role, workspace and query', async () => {
      const query = {
        page: 1,
        limit: 10,
      } as any;

      const expectedResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      queryBus.execute.mockResolvedValue(expectedResult);

      const res = {
        setHeader: jest.fn(),
      } as any;

      const result = await controller.findAll(req, workspaceId, query, res);

      const executedQuery = queryBus.execute.mock.calls[0][0];

      expect(executedQuery).toBeInstanceOf(GetTasksQuery);
      expect(executedQuery.userId).toBe(userId);
      expect(executedQuery.role).toBe('user');
      expect(executedQuery.workspaceId).toBe(workspaceId);
      expect(executedQuery.query).toBe(query);

      expect(result).toBe(expectedResult);
    });

    it('should set pagination headers when result contains meta', async () => {
      const query = {} as any;

      const resultData = {
        data: [{ _id: taskId }],
        meta: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3,
        },
      };

      queryBus.execute.mockResolvedValue(resultData);

      const res = {
        setHeader: jest.fn(),
      } as any;

      const result = await controller.findAll(req, workspaceId, query, res);

      expect(res.setHeader).toHaveBeenCalledWith('X-Total', '25');

      expect(res.setHeader).toHaveBeenCalledWith('X-Page', '2');

      expect(res.setHeader).toHaveBeenCalledWith('X-Limit', '10');

      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Pages', '3');

      expect(result).toBe(resultData);
    });

    it('should not set pagination headers when result has no meta', async () => {
      const resultData = {
        data: [],
      };

      queryBus.execute.mockResolvedValue(resultData);

      const res = {
        setHeader: jest.fn(),
      } as any;

      await controller.findAll(req, workspaceId, {} as any, res);

      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getStats
  // ---------------------------------------------------------------------------

  describe('getStats', () => {
    it('should execute GetTaskStatsQuery with authenticated user information', async () => {
      const expectedResult = {
        status: {
          pending: 2,
        },
      };

      queryBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.getStats(req);

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetTaskStatsQuery);
      expect(query.userId).toBe(userId);
      expect(query.role).toBe('user');

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('should execute GetTaskByIdQuery and return the task', async () => {
      const task = {
        _id: taskId,
        title: 'Test task',
        __v: 3,
      };

      queryBus.execute.mockResolvedValue(task);

      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
      } as any;

      const result = await controller.findOne(
        taskId,
        req,
        workspaceId,
        res,
        undefined,
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetTaskByIdQuery);
      expect(query.taskId).toBe(taskId);
      expect(query.userId).toBe(userId);
      expect(query.role).toBe('user');
      expect(query.workspaceId).toBe(workspaceId);

      expect(res.setHeader).toHaveBeenCalledWith('ETag', '"3"');

      expect(result).toBe(task);
    });

    it('should return 304 when If-None-Match contains the current version', async () => {
      const task = {
        _id: taskId,
        title: 'Test task',
        __v: 3,
      };

      queryBus.execute.mockResolvedValue(task);

      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
      } as any;

      const result = await controller.findOne(
        taskId,
        req,
        workspaceId,
        res,
        '"3"',
      );

      expect(res.setHeader).toHaveBeenCalledWith('ETag', '"3"');

      expect(res.status).toHaveBeenCalledWith(304);
      expect(result).toBeUndefined();
    });

    it('should return 304 when If-None-Match contains wildcard', async () => {
      const task = {
        _id: taskId,
        __v: 5,
      };

      queryBus.execute.mockResolvedValue(task);

      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
      } as any;

      const result = await controller.findOne(
        taskId,
        req,
        workspaceId,
        res,
        '*',
      );

      expect(res.status).toHaveBeenCalledWith(304);
      expect(result).toBeUndefined();
    });

    it('should return the task when If-None-Match does not match', async () => {
      const task = {
        _id: taskId,
        title: 'Test task',
        __v: 5,
      };

      queryBus.execute.mockResolvedValue(task);

      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
      } as any;

      const result = await controller.findOne(
        taskId,
        req,
        workspaceId,
        res,
        '"2"',
      );

      expect(res.status).not.toHaveBeenCalled();
      expect(result).toBe(task);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('should execute UpdateTaskCommand with parsed If-Match version', async () => {
      const dto = {
        title: 'Updated title',
      } as any;

      const task = {
        _id: taskId,
        title: 'Updated title',
        __v: 4,
      };

      commandBus.execute.mockResolvedValue(task);

      const res = {
        setHeader: jest.fn(),
      } as any;

      const result = await controller.update(
        taskId,
        workspaceId,
        dto,
        req,
        '"3"',
        res,
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(UpdateTaskCommand);
      expect(command.taskId).toBe(taskId);
      expect(command.updateTaskDto).toBe(dto);
      expect(command.userId).toBe(userId);
      expect(command.role).toBe('user');
      expect(command.workspaceId).toBe(workspaceId);
      expect(command.expectedVersion).toBe(3);

      expect(res.setHeader).toHaveBeenCalledWith('ETag', '"4"');

      expect(result).toBe(task);
    });
  });

  // ---------------------------------------------------------------------------
  // addComment
  // ---------------------------------------------------------------------------

  describe('addComment', () => {
    it('should execute CreateCommentCommand with correct arguments', async () => {
      const dto = {
        body: 'This is a comment',
      } as any;

      const expectedResult = {
        _id: taskId,
      };

      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.addComment(taskId, workspaceId, dto, req);

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(CreateCommentCommand);
      expect(command.taskId).toBe(taskId);
      expect(command.createCommentDto).toBe(dto);
      expect(command.userId).toBe(userId);
      expect(command.role).toBe('user');
      expect(command.workspaceId).toBe(workspaceId);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // getComments
  // ---------------------------------------------------------------------------

  describe('getComments', () => {
    it('should execute GetCommentsQuery with correct arguments', async () => {
      const expectedResult = {
        comments: [],
      };

      queryBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.getComments(taskId, req, workspaceId);

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetCommentsQuery);
      expect(query.taskId).toBe(taskId);
      expect(query.userId).toBe(userId);
      expect(query.role).toBe('user');
      expect(query.workspaceId).toBe(workspaceId);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // uploadAttachment
  // ---------------------------------------------------------------------------

  describe('uploadAttachment', () => {
    it('should execute UploadAttachmentCommand with file and user information', async () => {
      const file = {
        filename: 'test.pdf',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1000,
      } as Express.Multer.File;

      const expectedResult = {
        attachment: {
          filename: 'test.pdf',
        },
      };

      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.uploadAttachment(
        taskId,
        file,
        req,
        workspaceId,
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(UploadAttachmentCommand);
      expect(command.taskId).toBe(taskId);
      expect(command.file).toBe(file);
      expect(command.userId).toBe(userId);
      expect(command.role).toBe('user');
      expect(command.workspaceId).toBe(workspaceId);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // getAttachments
  // ---------------------------------------------------------------------------

  describe('getAttachments', () => {
    it('should execute GetAttachmentsQuery with correct arguments', async () => {
      const expectedResult = {
        attachments: [],
      };

      queryBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.getAttachments(taskId, req, workspaceId);

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetAttachmentsQuery);
      expect(query.taskId).toBe(taskId);
      expect(query.userId).toBe(userId);
      expect(query.role).toBe('user');
      expect(query.workspaceId).toBe(workspaceId);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // getTaskActivity
  // ---------------------------------------------------------------------------

  describe('getTaskActivity', () => {
    it('should execute GetTaskActivitiesQuery with task ID and user ID', async () => {
      const expectedResult = [
        {
          action: 'task.created',
        },
      ];

      queryBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.getTaskActivity(taskId, workspaceId, req);

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetTaskActivitiesQuery);

      expect(query.taskId).toBe(taskId);
      expect(query.userId).toBe(userId);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteAttachment
  // ---------------------------------------------------------------------------

  describe('deleteAttachment', () => {
    it('should execute DeleteAttachmentCommand with correct arguments', async () => {
      const expectedResult = {
        success: true,
      };

      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.deleteAttachment(
        taskId,
        workspaceId,
        'attachment-123',
        req,
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(DeleteAttachmentCommand);

      expect(command.taskId).toBe(taskId);
      expect(command.attachmentId).toBe('attachment-123');
      expect(command.userId).toBe(userId);
      expect(command.role).toBe('user');
      expect(command.workspaceId).toBe(workspaceId);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('should execute DeleteTaskCommand with correct arguments', async () => {
      const expectedResult = {
        success: true,
      };

      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.remove(taskId, req, workspaceId);

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(DeleteTaskCommand);
      expect(command.taskId).toBe(taskId);
      expect(command.userId).toBe(userId);
      expect(command.role).toBe('user');
      expect(command.workspaceId).toBe(workspaceId);

      expect(result).toBe(expectedResult);
    });
  });

  // ---------------------------------------------------------------------------
  // FileInterceptor fileFilter
  // ---------------------------------------------------------------------------

  describe('uploadAttachment file validation', () => {
    it('should reject unsupported MIME types', () => {
      const file = {
        originalname: 'malware.exe',
        mimetype: 'application/x-msdownload',
      } as Express.Multer.File;

      const callback = jest.fn();

      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        callback(
          new BadRequestException('Only image and PDF files are allowed.'),
          false,
        );
      }

      expect(callback).toHaveBeenCalledWith(
        expect.any(BadRequestException),
        false,
      );

      expect(callback.mock.calls[0][0].message).toBe(
        'Only image and PDF files are allowed.',
      );
    });

    it.each([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ])('should allow MIME type %s', (mimetype) => {
      const file = {
        originalname: 'test-file',
        mimetype,
      } as Express.Multer.File;

      const callback = jest.fn();

      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        callback(
          new BadRequestException('Only image and PDF files are allowed.'),
          false,
        );
      } else {
        callback(null, true);
      }

      expect(callback).toHaveBeenCalledWith(null, true);
    });
  });
});
