import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { TaskRepository } from './task.repository';
import { WorkspaceFeatureFlag } from 'src/workspace/domain/enums/workspace-feature-flag.enum';

describe('TaskRepository', () => {
  let repository: TaskRepository;

  let taskModel: any;
  let cacheManager: any;
  let featureFlagsService: any;

  const workspaceId = new Types.ObjectId().toString();
  const ownerId = new Types.ObjectId().toString();
  const taskId = new Types.ObjectId().toString();
  const attachmentId = new Types.ObjectId().toString();

  beforeEach(() => {
    taskModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    featureFlagsService = {
      isEnabled: jest.fn(),
    };

    repository = new TaskRepository(
      taskModel,
      cacheManager,
      featureFlagsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should create a task with owner and workspace ObjectIds', async () => {
      const task = {
        _id: new Types.ObjectId(),
        title: 'Test task',
      };

      taskModel.create.mockResolvedValue([task]);

      const dto = {
        title: 'Test task',
        description: 'Test description',
        workspaceId,
      } as any;

      const session = {} as any;

      const result = await repository.create(dto, ownerId, session);

      expect(taskModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            title: 'Test task',
            description: 'Test description',
            owner: expect.any(Types.ObjectId),
            workspace: expect.any(Types.ObjectId),
          }),
        ],
        { session },
      );

      expect(result).toBe(task);
    });

    it('should pass undefined session when no session is provided', async () => {
      const task = { _id: new Types.ObjectId() };

      taskModel.create.mockResolvedValue([task]);

      const dto = {
        title: 'Test task',
        workspaceId,
      } as any;

      await repository.create(dto, ownerId);

      expect(taskModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            owner: expect.any(Types.ObjectId),
            workspace: expect.any(Types.ObjectId),
          }),
        ],
        { session: undefined },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('should find a non-deleted task belonging to the workspace', async () => {
      const task = { _id: taskId };

      taskModel.findOne.mockResolvedValue(task);

      const result = await repository.findById(taskId, workspaceId);

      expect(taskModel.findOne).toHaveBeenCalledWith({
        _id: taskId,
        workspace: expect.any(Types.ObjectId),
        isDeleted: false,
      });

      expect(result).toBe(task);
    });

    it('should return null when task does not exist', async () => {
      taskModel.findOne.mockResolvedValue(null);

      const result = await repository.findById(taskId, workspaceId);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findAuthorizedTask
  // ---------------------------------------------------------------------------

  describe('findAuthorizedTask', () => {
    it('should find and populate owner and category', async () => {
      const task = { _id: taskId };

      const populateCategory = jest.fn().mockResolvedValue(task);
      const populateOwner = jest.fn().mockReturnValue({
        populate: populateCategory,
      });

      taskModel.findOne.mockReturnValue({
        populate: populateOwner,
      });

      const result = await repository.findAuthorizedTask(
        taskId,
        ownerId,
        'admin',
        workspaceId,
      );

      expect(taskModel.findOne).toHaveBeenCalledWith({
        _id: taskId,
        workspace: expect.any(Types.ObjectId),
        isDeleted: false,
      });

      expect(populateOwner).toHaveBeenCalledWith('owner');
      expect(populateCategory).toHaveBeenCalledWith('category');

      expect(result).toBe(task);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      const populateCategory = jest.fn().mockResolvedValue(null);
      const populateOwner = jest.fn().mockReturnValue({
        populate: populateCategory,
      });

      taskModel.findOne.mockReturnValue({
        populate: populateOwner,
      });

      await expect(
        repository.findAuthorizedTask(taskId, ownerId, 'admin', workspaceId),
      ).rejects.toThrow(new NotFoundException('Task Not Found'));
    });
  });

  // ---------------------------------------------------------------------------
  // save
  // ---------------------------------------------------------------------------

  describe('save', () => {
    it('should save and return the task', async () => {
      const task = {
        save: jest.fn().mockResolvedValue({ _id: taskId }),
      };

      const result = await repository.save(task as any);

      expect(task.save).toHaveBeenCalled();
      expect(result).toEqual({ _id: taskId });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('should update a non-deleted task and return the updated document', async () => {
      const updatedTask = { _id: taskId, title: 'Updated' };

      taskModel.findOneAndUpdate.mockResolvedValue(updatedTask);

      const dto = {
        title: 'Updated',
      } as any;

      const result = await repository.update(taskId, workspaceId, dto);

      expect(taskModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: taskId,
          workspace: expect.any(Types.ObjectId),
          isDeleted: false,
        },
        dto,
        {
          new: true,
        },
      );

      expect(result).toBe(updatedTask);
    });

    it('should return null when task does not exist', async () => {
      taskModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await repository.update(taskId, workspaceId, {} as any);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('should soft delete the task', async () => {
      taskModel.findOneAndUpdate.mockResolvedValue({});

      await repository.delete(taskId, workspaceId);

      expect(taskModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: taskId,
          workspace: expect.any(Types.ObjectId),
          isDeleted: false,
        },
        {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    beforeEach(() => {
      cacheManager.get.mockResolvedValue(null);
      cacheManager.set.mockResolvedValue(undefined);
      taskModel.aggregate.mockResolvedValue([]);
      taskModel.countDocuments.mockResolvedValue(0);

      // Advanced filtering is enabled by default.
      // Individual tests can override this when testing the disabled case.
      featureFlagsService.isEnabled.mockResolvedValue(true);
    });

    it('should return cached result without querying MongoDB', async () => {
      const cachedResult = {
        data: [{ _id: taskId }],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      cacheManager.get.mockResolvedValue(cachedResult);

      const result = await repository.findAll(ownerId, 'user', workspaceId, {});

      expect(result).toBe(cachedResult);
      expect(taskModel.aggregate).not.toHaveBeenCalled();
      expect(taskModel.countDocuments).not.toHaveBeenCalled();
    });

    it('should only filter by owner for non-admin users', async () => {
      taskModel.aggregate.mockResolvedValue([{ _id: taskId }]);

      taskModel.countDocuments.mockResolvedValue(1);

      await repository.findAll(ownerId, 'user', workspaceId, {});

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.owner).toBeInstanceOf(Types.ObjectId);
      expect(pipeline[0].$match.workspace).toBeInstanceOf(Types.ObjectId);
      expect(pipeline[0].$match.isDeleted).toBe(false);
    });

    it('should not restrict by owner for admin users', async () => {
      await repository.findAll(ownerId, 'admin', workspaceId, {});

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.owner).toBeUndefined();
      expect(pipeline[0].$match.workspace).toBeInstanceOf(Types.ObjectId);
    });

    it('should apply status filter', async () => {
      await repository.findAll(ownerId, 'user', workspaceId, {
        status: 'done',
      } as any);

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.status).toBe('done');
    });

    it('should apply text search filter', async () => {
      await repository.findAll(ownerId, 'user', workspaceId, {
        search: 'nestjs',
      } as any);

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.$text).toEqual({
        $search: 'nestjs',
      });
    });

    it('should apply due date range filters', async () => {
      await repository.findAll(ownerId, 'user', workspaceId, {
        dueFrom: '2026-01-01',
        dueTo: '2026-12-31',
      } as any);

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.dueDate.$gte).toEqual(new Date('2026-01-01'));

      expect(pipeline[0].$match.dueDate.$lte).toEqual(new Date('2026-12-31'));
    });

    it('should apply tags filter', async () => {
      await repository.findAll(ownerId, 'user', workspaceId, {
        tags: 'backend,nestjs,mongodb',
      } as any);

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.tags).toEqual({
        $all: ['backend', 'nestjs', 'mongodb'],
      });
    });

    it('should filter assignee by "me"', async () => {
      await repository.findAll(ownerId, 'user', workspaceId, {
        assignee: 'me',
      } as any);

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.assignees).toEqual(expect.any(Types.ObjectId));
    });

    it('should throw BadRequestException for invalid assignee ID', async () => {
      await expect(
        repository.findAll(ownerId, 'user', workspaceId, {
          assignee: 'invalid-id',
        } as any),
      ).rejects.toThrow(new BadRequestException('Invalid assignee ID'));

      expect(taskModel.aggregate).not.toHaveBeenCalled();
    });

    it('should use custom assignee ObjectId when valid', async () => {
      const assigneeId = new Types.ObjectId().toString();

      await repository.findAll(ownerId, 'user', workspaceId, {
        assignee: assigneeId,
      } as any);

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.assignees).toBeInstanceOf(Types.ObjectId);

      expect(pipeline[0].$match.assignees.toString()).toBe(assigneeId);
    });

    it('should throw ForbiddenException when advanced filtering is disabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);

      await expect(
        repository.findAll(ownerId, 'user', workspaceId, {
          dueFrom: '2026-01-01',
        } as any),
      ).rejects.toThrow(
        new ForbiddenException(
          'Advanced task filtering is disabled for this workspace',
        ),
      );

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        workspaceId,
        WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING,
      );

      expect(taskModel.aggregate).not.toHaveBeenCalled();
    });

    it('should allow advanced filtering when feature flag is enabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      await repository.findAll(ownerId, 'user', workspaceId, {
        dueFrom: '2026-01-01',
      } as any);

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        workspaceId,
        WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING,
      );

      expect(taskModel.aggregate).toHaveBeenCalled();
    });

    it('should return offset pagination result', async () => {
      const tasks = [
        { _id: new Types.ObjectId(), title: 'Task 1' },
        { _id: new Types.ObjectId(), title: 'Task 2' },
      ];

      taskModel.aggregate.mockResolvedValue(tasks);
      taskModel.countDocuments.mockResolvedValue(25);

      const result = await repository.findAll(ownerId, 'user', workspaceId, {
        page: 2,
        limit: 10,
      } as any);

      expect(result).toEqual({
        data: tasks,
        meta: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3,
        },
      });

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('tasks:'),
        expect.objectContaining({
          data: tasks,
        }),
        60 * 1000,
      );
    });

    it('should use cursor pagination and generate nextCursor', async () => {
      const firstId = new Types.ObjectId();
      const secondId = new Types.ObjectId();

      taskModel.aggregate.mockResolvedValue([
        { _id: firstId },
        { _id: secondId },
        { _id: new Types.ObjectId() },
      ]);

      const result = await repository.findAll(ownerId, 'user', workspaceId, {
        pagination: 'cursor',
        limit: 2,
      } as any);

      expect(result).toEqual({
        data: [{ _id: firstId }, { _id: secondId }],
        meta: {
          limit: 2,
          nextCursor: secondId.toString(),
        },
      });

      expect(taskModel.countDocuments).not.toHaveBeenCalled();
    });

    it('should return null nextCursor when cursor pagination has no next page', async () => {
      const firstId = new Types.ObjectId();

      taskModel.aggregate.mockResolvedValue([{ _id: firstId }]);

      const result = await repository.findAll(ownerId, 'user', workspaceId, {
        pagination: 'cursor',
        limit: 10,
      } as any);

      expect(result).toEqual({
        data: [{ _id: firstId }],
        meta: {
          limit: 10,
          nextCursor: null,
        },
      });
    });

    it('should apply cursor filter when cursor is provided', async () => {
      const cursorId = new Types.ObjectId().toString();

      await repository.findAll(ownerId, 'user', workspaceId, {
        pagination: 'cursor',
        cursor: cursorId,
      } as any);

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match._id.$gt).toBeInstanceOf(Types.ObjectId);

      expect(pipeline[0].$match._id.$gt.toString()).toBe(cursorId);
    });

    it('should reject custom sorting with cursor pagination', async () => {
      await expect(
        repository.findAll(ownerId, 'user', workspaceId, {
          pagination: 'cursor',
          sortBy: 'priority',
        } as any),
      ).rejects.toThrow(
        new BadRequestException(
          'Cursor pagination does not support custom sorting.',
        ),
      );
    });

    it('should reject custom order with cursor pagination', async () => {
      await expect(
        repository.findAll(ownerId, 'user', workspaceId, {
          pagination: 'cursor',
          order: 'asc',
        } as any),
      ).rejects.toThrow(
        new BadRequestException(
          'Cursor pagination does not support custom sorting.',
        ),
      );
    });

    it('should apply custom sort fields', async () => {
      await repository.findAll(ownerId, 'admin', workspaceId, {
        sort: 'priority:desc,createdAt:asc',
      } as any);

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      const sortStage = pipeline.find((stage: any) => stage.$sort);

      expect(sortStage.$sort).toEqual({
        priorityWeight: -1,
        createdAt: 1,
        _id: 1,
      });
    });

    it('should cache the result', async () => {
      taskModel.aggregate.mockResolvedValue([{ _id: taskId }]);

      taskModel.countDocuments.mockResolvedValue(1);

      await repository.findAll(ownerId, 'user', workspaceId, {});

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('tasks:'),
        expect.objectContaining({
          data: [{ _id: taskId }],
        }),
        60 * 1000,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // clearCache
  // ---------------------------------------------------------------------------

  describe('clearCache', () => {
    it('should delete all tracked cache keys and clear the set', async () => {
      cacheManager.get.mockResolvedValue(null);
      taskModel.aggregate.mockResolvedValue([]);
      taskModel.countDocuments.mockResolvedValue(0);

      await repository.findAll(ownerId, 'user', workspaceId, {});

      await repository.clearCache();

      expect(cacheManager.del).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when there are no tracked cache keys', async () => {
      await repository.clearCache();

      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // uploadAttachment
  // ---------------------------------------------------------------------------

  describe('uploadAttachment', () => {
    it('should add an attachment and save the task', async () => {
      const task = {
        attachments: [],
        save: jest.fn().mockResolvedValue({
          _id: taskId,
        }),
      };

      taskModel.findById.mockResolvedValue(task);

      const file = {
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        size: 12345,
      } as Express.Multer.File;

      const result = await repository.uploadAttachment(taskId, file);

      expect(task.attachments).toHaveLength(1);
      expect(task.attachments[0]).toEqual({
        filename: 'test.pdf',
        mime: 'application/pdf',
        size: 12345,
        url: '/uploads/test.pdf',
      });

      expect(task.save).toHaveBeenCalled();
      expect(result).toEqual({ _id: taskId });
    });

    it('should throw NotFoundException when task does not exist', async () => {
      taskModel.findById.mockResolvedValue(null);

      await expect(
        repository.uploadAttachment(taskId, {} as any),
      ).rejects.toThrow(new NotFoundException('Task Not Found'));
    });
  });

  // ---------------------------------------------------------------------------
  // deleteAttachment
  // ---------------------------------------------------------------------------

  describe('deleteAttachment', () => {
    it('should remove the requested attachment and save the task', async () => {
      const otherAttachmentId = new Types.ObjectId();

      const task = {
        attachments: [
          {
            _id: new Types.ObjectId(attachmentId),
            filename: 'delete-me.pdf',
          },
          {
            _id: otherAttachmentId,
            filename: 'keep-me.pdf',
          },
        ],
        save: jest.fn().mockResolvedValue({
          _id: taskId,
        }),
      };

      taskModel.findById.mockResolvedValue(task);

      const result = await repository.deleteAttachment(taskId, attachmentId);

      expect(task.attachments).toHaveLength(1);
      expect(task.attachments[0].filename).toBe('keep-me.pdf');
      expect(task.save).toHaveBeenCalled();
      expect(result).toEqual({ _id: taskId });
    });

    it('should throw NotFoundException when task does not exist', async () => {
      taskModel.findById.mockResolvedValue(null);

      await expect(
        repository.deleteAttachment(taskId, attachmentId),
      ).rejects.toThrow(new NotFoundException('Task Not Found'));
    });

    it('should throw NotFoundException when attachment does not exist', async () => {
      const task = {
        attachments: [],
        save: jest.fn(),
      };

      taskModel.findById.mockResolvedValue(task);

      await expect(
        repository.deleteAttachment(taskId, attachmentId),
      ).rejects.toThrow(new NotFoundException('Attachment Not Found'));

      expect(task.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getAttachments
  // ---------------------------------------------------------------------------

  describe('getAttachments', () => {
    it('should return the task', async () => {
      const task = { _id: taskId };

      taskModel.findById.mockResolvedValue(task);

      const result = await repository.getAttachments(taskId);

      expect(taskModel.findById).toHaveBeenCalledWith(taskId);
      expect(result).toBe(task);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      taskModel.findById.mockResolvedValue(null);

      await expect(repository.getAttachments(taskId)).rejects.toThrow(
        new NotFoundException('Task Not Found'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // addComment
  // ---------------------------------------------------------------------------

  describe('addComment', () => {
    it('should add a comment and save the task', async () => {
      const task = {
        comments: [],
        save: jest.fn().mockResolvedValue({
          _id: taskId,
        }),
      };

      taskModel.findById.mockResolvedValue(task);

      const result = await repository.addComment(
        taskId,
        {
          body: 'This is a comment',
        } as any,
        ownerId,
      );

      expect(task.comments).toHaveLength(1);
      expect(task.comments[0]).toEqual(
        expect.objectContaining({
          author: ownerId,
          body: 'This is a comment',
          createdAt: expect.any(Date),
        }),
      );

      expect(task.save).toHaveBeenCalled();
      expect(result).toEqual({ _id: taskId });
    });

    it('should throw NotFoundException when task does not exist', async () => {
      taskModel.findById.mockResolvedValue(null);

      await expect(
        repository.addComment(taskId, { body: 'Comment' } as any, ownerId),
      ).rejects.toThrow(new NotFoundException('Task Not Found'));
    });
  });

  // ---------------------------------------------------------------------------
  // getComments
  // ---------------------------------------------------------------------------

  describe('getComments', () => {
    it('should populate comment authors and return the task', async () => {
      const task = { _id: taskId };

      const populate = jest.fn().mockResolvedValue(task);

      taskModel.findById.mockReturnValue({
        populate,
      });

      const result = await repository.getComments(taskId);

      expect(taskModel.findById).toHaveBeenCalledWith(taskId);
      expect(populate).toHaveBeenCalledWith('comments.author');
      expect(result).toBe(task);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      const populate = jest.fn().mockResolvedValue(null);

      taskModel.findById.mockReturnValue({
        populate,
      });

      await expect(repository.getComments(taskId)).rejects.toThrow(
        new NotFoundException('Task Not Found'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getStats
  // ---------------------------------------------------------------------------

  describe('getStats', () => {
    it('should return cached statistics', async () => {
      const cached = {
        status: {
          pending: 3,
        },
        priority: {
          high: 2,
        },
        overdue: 1,
      };

      cacheManager.get.mockResolvedValue(cached);

      const result = await repository.getStats(ownerId, 'user');

      expect(result).toBe(cached);
      expect(taskModel.aggregate).not.toHaveBeenCalled();
    });

    it('should calculate statistics for a regular user', async () => {
      taskModel.aggregate.mockResolvedValue([
        {
          status: [
            { _id: 'pending', count: 3 },
            { _id: 'done', count: 2 },
          ],
          priority: [
            { _id: 'high', count: 2 },
            { _id: 'low', count: 3 },
          ],
          overdue: [{ count: 1 }],
        },
      ]);

      const result = await repository.getStats(ownerId, 'user');

      expect(result).toEqual({
        status: {
          pending: 3,
          done: 2,
        },
        priority: {
          high: 2,
          low: 3,
        },
        overdue: 1,
      });

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.owner).toBeInstanceOf(Types.ObjectId);

      expect(pipeline[0].$match.isDeleted).toBe(false);
    });

    it('should not filter by owner for admin statistics', async () => {
      taskModel.aggregate.mockResolvedValue([
        {
          status: [],
          priority: [],
          overdue: [],
        },
      ]);

      await repository.getStats(ownerId, 'admin');

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match).toEqual({
        isDeleted: false,
      });
    });

    it('should return zero overdue when no overdue tasks exist', async () => {
      taskModel.aggregate.mockResolvedValue([
        {
          status: [],
          priority: [],
          overdue: [],
        },
      ]);

      const result = await repository.getStats(ownerId, 'user');

      expect((result as any).overdue).toBe(0);
    });

    it('should cache calculated statistics', async () => {
      taskModel.aggregate.mockResolvedValue([
        {
          status: [],
          priority: [],
          overdue: [],
        },
      ]);

      const result = await repository.getStats(ownerId, 'user');

      expect(cacheManager.set).toHaveBeenCalledWith(
        `stats:${ownerId}:user`,
        result,
        60 * 1000,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // assignUsers
  // ---------------------------------------------------------------------------

  describe('assignUsers', () => {
    it('should assign users and save the task', async () => {
      const task = {
        assignees: [] as Types.ObjectId[],
        save: jest.fn().mockResolvedValue({
          _id: taskId,
        }),
      };

      taskModel.findById.mockResolvedValue(task);

      const user1 = new Types.ObjectId().toString();
      const user2 = new Types.ObjectId().toString();

      const result = await repository.assignUsers(taskId, [user1, user2]);

      expect(task.assignees).toHaveLength(2);
      expect(task.assignees[0]).toBeInstanceOf(Types.ObjectId);
      expect(task.assignees[1]).toBeInstanceOf(Types.ObjectId);

      expect(task.assignees[0].toString()).toBe(user1);
      expect(task.assignees[1].toString()).toBe(user2);

      expect(task.save).toHaveBeenCalled();
      expect(result).toEqual({ _id: taskId });
    });

    it('should throw NotFoundException when task does not exist', async () => {
      taskModel.findById.mockResolvedValue(null);

      await expect(repository.assignUsers(taskId, [ownerId])).rejects.toThrow(
        new NotFoundException('Task Not Found'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // aggregateWorkspaceTasks
  // ---------------------------------------------------------------------------

  describe('aggregateWorkspaceTasks', () => {
    it('should aggregate workspace tasks with default empty result handling', async () => {
      taskModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await repository.aggregateWorkspaceTasks(
        workspaceId,
        1,
        10,
      );

      expect(result).toEqual({
        data: [],
        total: 0,
        stats: [],
      });
    });

    it('should return aggregated workspace task data', async () => {
      const aggregateResult = [
        {
          data: [{ _id: taskId }],
          total: [{ count: 25 }],
          stats: [
            { _id: 'pending', count: 10 },
            { _id: 'done', count: 15 },
          ],
        },
      ];

      taskModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      });

      const result = await repository.aggregateWorkspaceTasks(
        workspaceId,
        2,
        10,
      );

      expect(result).toEqual({
        data: [{ _id: taskId }],
        total: 25,
        stats: [
          { _id: 'pending', count: 10 },
          { _id: 'done', count: 15 },
        ],
      });
    });

    it('should apply status filter', async () => {
      taskModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await repository.aggregateWorkspaceTasks(workspaceId, 1, 10, 'done');

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.status).toBe('done');
    });

    it('should apply text search filter', async () => {
      taskModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await repository.aggregateWorkspaceTasks(
        workspaceId,
        1,
        10,
        undefined,
        'nestjs',
      );

      const pipeline = taskModel.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.$text).toEqual({
        $search: 'nestjs',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findAllForExport
  // ---------------------------------------------------------------------------

  describe('findAllForExport', () => {
    it('should return non-deleted tasks for the workspace', async () => {
      const tasks = [
        {
          _id: taskId,
          title: 'Task 1',
        },
      ];

      const exec = jest.fn().mockResolvedValue(tasks);
      const lean = jest.fn().mockReturnValue({ exec });
      const select = jest.fn().mockReturnValue({ lean });

      taskModel.find.mockReturnValue({
        select,
      });

      const result = await repository.findAllForExport(workspaceId);

      expect(taskModel.find).toHaveBeenCalledWith({
        workspace: expect.any(Types.ObjectId),
        isDeleted: false,
      });

      expect(select).toHaveBeenCalledWith('-__v');
      expect(lean).toHaveBeenCalled();
      expect(exec).toHaveBeenCalled();

      expect(result).toBe(tasks);
    });
  });
});
