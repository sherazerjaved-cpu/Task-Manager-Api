import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, UserSchema } from 'src/users/Schema/user.schema';
import { TaskRepository } from '../../../src/task/infrastructure/persistence/task.repository';
import {
  Task,
  TaskDocument,
  TaskSchema,
} from '../../../src/task/Schema/task.schema';
import {
  Category,
  CategorySchema,
} from 'src/categories/Schema/categories.schema';
import { FeatureFlagsService } from '../../../src/workspace/application/services/feature-flags.service';
import { WorkspaceFeatureFlag } from '../../../src/workspace/domain/enums/workspace-feature-flag.enum';

import { TaskPriority } from '../../../src/task/Enums/task-priority.enum';
import { TaskStatus } from '../../../src/task/Enums/task-status.enum';

import { CACHE_MANAGER } from '@nestjs/cache-manager';

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
jest.setTimeout(30000);

describe('TaskRepository Integration', () => {
  let module: TestingModule;
  let repository: TaskRepository;
  let taskModel: Model<TaskDocument>;
  let mongoServer: MongoMemoryServer;

  const ownerId = new Types.ObjectId();
  const adminId = new Types.ObjectId();

  const workspaceId = new Types.ObjectId();
  const otherWorkspaceId = new Types.ObjectId();

  const otherUserId = new Types.ObjectId();

  /**
   * Simple cache implementation.
   *
   * The repository's database behavior is real MongoDB.
   * The cache is intentionally kept deterministic for integration tests.
   */
  const cacheStore = new Map<string, unknown>();

  const cacheManager = {
    get: jest.fn(async (key: string) => {
      return cacheStore.get(key);
    }),

    set: jest.fn(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
      return value;
    }),

    del: jest.fn(async (key: string) => {
      cacheStore.delete(key);
    }),

    clear: jest.fn(async () => {
      cacheStore.clear();
    }),
  };

  const featureFlagsService = {
    isEnabled: jest.fn(),
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();

    const mongoUri = mongoServer.getUri();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          {
            name: Task.name,
            schema: TaskSchema,
          },
          {
            name: Category.name,
            schema: CategorySchema,
          },
          {
            name: User.name,
            schema: UserSchema,
          },
        ]),
      ],

      providers: [
        TaskRepository,

        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },

        {
          provide: FeatureFlagsService,
          useValue: featureFlagsService,
        },
      ],
    }).compile();

    repository = module.get<TaskRepository>(TaskRepository);

    taskModel = module.get<Model<TaskDocument>>(getModelToken(Task.name));
  });

  beforeEach(async () => {
    await taskModel.deleteMany({});

    cacheStore.clear();

    jest.clearAllMocks();

    /**
     * By default advanced filtering is enabled.
     *
     * Individual tests can override this behavior.
     */
    featureFlagsService.isEnabled.mockResolvedValue(true);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }

    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function createTask(
    overrides: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      dueDate: Date;
      category: Types.ObjectId;
      tags: string[];
      owner: Types.ObjectId;
      workspace: Types.ObjectId;
      assignees: Types.ObjectId[];
    }> = {},
  ) {
    return taskModel.create({
      title: 'Test Task',
      description: 'Test task description',
      status: TaskStatus.Pending,
      priority: TaskPriority.Medium,
      dueDate: new Date('2026-08-25T12:00:00.000Z'),
      tags: ['nestjs', 'backend'],
      owner: ownerId,
      workspace: workspaceId,
      assignees: [],

      ...overrides,
    });
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  describe('create()', () => {
    it('should create a task in the requested workspace', async () => {
      const result = await repository.create(
        {
          title: 'Create Integration Task',
          description: 'Created using repository integration test',
          priority: TaskPriority.High,
          status: TaskStatus.Pending,
          workspaceId: workspaceId.toString(),
          tags: ['integration'],
        },
        ownerId.toString(),
      );

      expect(result).toBeDefined();
      expect(result._id).toBeDefined();

      expect(result.title).toBe('Create Integration Task');
      expect(result.description).toBe(
        'Created using repository integration test',
      );

      expect(result.priority).toBe(TaskPriority.High);
      expect(result.status).toBe(TaskStatus.Pending);

      expect(result.owner.toString()).toBe(ownerId.toString());
      expect(result.workspace.toString()).toBe(workspaceId.toString());

      const persisted = await taskModel.findById(result._id);

      expect(persisted).not.toBeNull();
      expect(persisted!.title).toBe('Create Integration Task');
    });

    it('should convert owner and workspace IDs to ObjectIds', async () => {
      const result = await repository.create(
        {
          title: 'ObjectId Task',
          workspaceId: workspaceId.toString(),
        },
        ownerId.toString(),
      );

      expect(result.owner).toBeInstanceOf(Types.ObjectId);
      expect(result.workspace).toBeInstanceOf(Types.ObjectId);
    });

    it('should apply schema defaults', async () => {
      const result = await repository.create(
        {
          title: 'Defaults Task',
          workspaceId: workspaceId.toString(),
        },
        ownerId.toString(),
      );

      expect(result.status).toBe(TaskStatus.Pending);
      expect(result.priority).toBe(TaskPriority.Medium);
      expect(result.isDeleted).toBe(false);
      expect(result.reminderSent).toBe(false);
      expect(result.comments).toEqual([]);
      expect(result.attachments).toEqual([]);
      expect(result.assignees).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // FIND BY ID
  // ---------------------------------------------------------------------------

  describe('findById()', () => {
    it('should return a task belonging to the requested workspace', async () => {
      const task = await createTask();

      const result = await repository.findById(
        task._id.toString(),
        workspaceId.toString(),
      );

      expect(result).not.toBeNull();
      expect(result!._id.toString()).toBe(task._id.toString());
    });

    it('should not return a task from another workspace', async () => {
      const task = await createTask({
        workspace: otherWorkspaceId,
      });

      const result = await repository.findById(
        task._id.toString(),
        workspaceId.toString(),
      );

      expect(result).toBeNull();
    });

    it('should not return a soft-deleted task', async () => {
      const task = await createTask({
        isDeleted: true,
      } as any);

      const result = await repository.findById(
        task._id.toString(),
        workspaceId.toString(),
      );

      expect(result).toBeNull();
    });

    it('should return null for a non-existing task', async () => {
      const result = await repository.findById(
        new Types.ObjectId().toString(),
        workspaceId.toString(),
      );

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // AUTHORIZED TASK
  // ---------------------------------------------------------------------------

  describe('findAuthorizedTask()', () => {
    it('should return a task inside the workspace', async () => {
      const task = await createTask();

      const result = await repository.findAuthorizedTask(
        task._id.toString(),
        ownerId.toString(),
        'user',
        workspaceId.toString(),
      );

      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(task._id.toString());
    });

    it('should throw NotFoundException for a task outside the workspace', async () => {
      const task = await createTask({
        workspace: otherWorkspaceId,
      });

      await expect(
        repository.findAuthorizedTask(
          task._id.toString(),
          ownerId.toString(),
          'user',
          workspaceId.toString(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw NotFoundException for a deleted task', async () => {
      const task = await createTask({
        isDeleted: true,
      } as any);

      await expect(
        repository.findAuthorizedTask(
          task._id.toString(),
          ownerId.toString(),
          'user',
          workspaceId.toString(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  describe('update()', () => {
    it('should update a task inside the workspace', async () => {
      const task = await createTask({
        title: 'Before Update',
      });

      const result = await repository.update(
        task._id.toString(),
        workspaceId.toString(),
        {
          title: 'After Update',
          priority: TaskPriority.High,
        },
      );

      expect(result).not.toBeNull();
      expect(result!.title).toBe('After Update');
      expect(result!.priority).toBe(TaskPriority.High);
    });

    it('should not update a task from another workspace', async () => {
      const task = await createTask({
        workspace: otherWorkspaceId,
      });

      const result = await repository.update(
        task._id.toString(),
        workspaceId.toString(),
        {
          title: 'Should Not Update',
        },
      );

      expect(result).toBeNull();

      const persisted = await taskModel.findById(task._id);

      expect(persisted!.title).toBe('Test Task');
    });

    it('should not update a soft-deleted task', async () => {
      const task = await createTask({
        isDeleted: true,
      } as any);

      const result = await repository.update(
        task._id.toString(),
        workspaceId.toString(),
        {
          title: 'Should Not Update',
        },
      );

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  describe('delete()', () => {
    it('should soft delete a task', async () => {
      const task = await createTask();

      await repository.delete(task._id.toString(), workspaceId.toString());

      const deleted = await taskModel.findById(task._id);

      expect(deleted).not.toBeNull();
      expect(deleted!.isDeleted).toBe(true);
      expect(deleted!.deletedAt).toBeDefined();
    });

    it('should not delete a task belonging to another workspace', async () => {
      const task = await createTask({
        workspace: otherWorkspaceId,
      });

      await repository.delete(task._id.toString(), workspaceId.toString());

      const persisted = await taskModel.findById(task._id);

      expect(persisted!.isDeleted).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // FIND ALL
  // ---------------------------------------------------------------------------

  describe('findAll()', () => {
    beforeEach(async () => {
      await createTask({
        title: 'Pending Low',
        status: TaskStatus.Pending,
        priority: TaskPriority.Low,
        tags: ['nestjs'],
        dueDate: new Date('2026-08-20'),
      });

      await createTask({
        title: 'In Progress Medium',
        status: TaskStatus.In_Progress,
        priority: TaskPriority.Medium,
        tags: ['backend'],
        dueDate: new Date('2026-08-25'),
      });

      await createTask({
        title: 'Done High',
        status: TaskStatus.Done,
        priority: TaskPriority.High,
        tags: ['nestjs', 'database'],
        dueDate: new Date('2026-08-30'),
      });

      await createTask({
        title: 'Other User Task',
        owner: otherUserId,
        priority: TaskPriority.High,
      });

      await createTask({
        title: 'Other Workspace Task',
        workspace: otherWorkspaceId,
        priority: TaskPriority.High,
      });
    });

    it('should return only tasks belonging to the workspace', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {},
      );

      expect(result.data).toHaveLength(3);

      result.data.forEach((task: any) => {
        expect(task.workspace.toString()).toBe(workspaceId.toString());
      });
    });

    it('should return only the authenticated user tasks for a normal user', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {},
      );

      expect(result.data).toHaveLength(3);

      const taskIds = result.data.map((task: any) => task._id.toString());

      const tasksFromDb = await taskModel.find({
        _id: { $in: taskIds },
      });

      tasksFromDb.forEach((task) => {
        expect(task.owner.toString()).toBe(ownerId.toString());
      });
    });
    it('should return all workspace tasks for admin', async () => {
      const result: any = await repository.findAll(
        adminId.toString(),
        'admin',
        workspaceId.toString(),
        {},
      );

      expect(result.data).toHaveLength(4);
    });

    it('should support status filtering', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          status: TaskStatus.Done,
        },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(TaskStatus.Done);
    });

    it('should support text search', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          search: 'Pending Low',
        },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Pending Low');
    });

    it('should support tags filtering', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          tags: 'nestjs',
        },
      );

      expect(result.data).toHaveLength(2);
    });

    it('should support multiple tags using $all', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          tags: 'nestjs,database',
        },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Done High');
    });

    it('should support assignee=me', async () => {
      await createTask({
        title: 'Assigned To Me',
        assignees: [ownerId],
      });

      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          assignee: 'me',
        },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Assigned To Me');
    });

    it('should support assignee user ID', async () => {
      await createTask({
        title: 'Assigned To Other User',
        assignees: [otherUserId],
      });

      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          assignee: otherUserId.toString(),
        },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Assigned To Other User');
    });

    it('should reject an invalid assignee ID', async () => {
      await expect(
        repository.findAll(ownerId.toString(), 'user', workspaceId.toString(), {
          assignee: 'invalid-id',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should support dueFrom filtering', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          dueFrom: '2026-08-25T00:00:00.000Z',
        },
      );

      expect(result.data.length).toBeGreaterThanOrEqual(1);

      result.data.forEach((task: any) => {
        expect(new Date(task.dueDate).getTime()).toBeGreaterThanOrEqual(
          new Date('2026-08-25').getTime(),
        );
      });
    });

    it('should support dueTo filtering', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          dueTo: '2026-08-25T23:59:59.999Z',
        },
      );

      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should support offset pagination', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          page: 1,
          limit: 2,
          pagination: 'offset',
        },
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(2);
      expect(result.meta.total).toBe(3);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should support the second offset page', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          page: 2,
          limit: 2,
          pagination: 'offset',
        },
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should support priority sorting', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          sort: 'priority:desc',
        },
      );

      expect(result.data[0].priority).toBe(TaskPriority.High);

      expect(result.data[1].priority).toBe(TaskPriority.Medium);

      expect(result.data[2].priority).toBe(TaskPriority.Low);
    });

    it('should support ascending priority sorting', async () => {
      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          sort: 'priority:asc',
        },
      );

      expect(result.data[0].priority).toBe(TaskPriority.Low);

      expect(result.data[2].priority).toBe(TaskPriority.High);
    });

    it('should reject custom sorting with cursor pagination', async () => {
      await expect(
        repository.findAll(ownerId.toString(), 'user', workspaceId.toString(), {
          pagination: 'cursor',
          sort: 'priority:desc',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should support cursor pagination', async () => {
      const firstPage: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          pagination: 'cursor',
          limit: 2,
        },
      );

      expect(firstPage.data).toHaveLength(2);
      expect(firstPage.meta).toHaveProperty('nextCursor');

      expect(firstPage.meta.nextCursor).not.toBeNull();

      const secondPage: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          pagination: 'cursor',
          limit: 2,
          cursor: firstPage.meta.nextCursor,
        },
      );

      expect(secondPage.data).toHaveLength(1);
      expect(secondPage.data[0]._id.toString()).not.toBe(
        firstPage.data[0]._id.toString(),
      );
    });

    it('should use cache on repeated requests', async () => {
      const query = {
        page: 1,
        limit: 10,
      };

      const firstResult: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        query,
      );

      const secondResult: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        query,
      );

      expect(secondResult).toEqual(firstResult);

      expect(cacheManager.get).toHaveBeenCalled();
    });

    it('should not return soft-deleted tasks', async () => {
      await createTask({
        title: 'Deleted Task',
        isDeleted: true,
      } as any);

      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {},
      );

      expect(
        result.data.some((task: any) => task.title === 'Deleted Task'),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // ADVANCED FILTER FEATURE FLAG
  // ---------------------------------------------------------------------------

  describe('advanced task filtering feature flag', () => {
    it('should reject advanced filtering when feature flag is disabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);

      await expect(
        repository.findAll(ownerId.toString(), 'user', workspaceId.toString(), {
          dueFrom: '2026-08-01',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        workspaceId.toString(),
        WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING,
      );
    });

    it('should reject advanced sorting when feature flag is disabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);

      await expect(
        repository.findAll(ownerId.toString(), 'user', workspaceId.toString(), {
          sort: 'priority:desc',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow advanced filtering when feature flag is enabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      await createTask({
        title: 'Advanced Filter Task',
        priority: TaskPriority.High,
      });

      const result: any = await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {
          sort: 'priority:desc',
        },
      );

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // ATTACHMENTS
  // ---------------------------------------------------------------------------

  describe('attachments', () => {
    it('should upload an attachment', async () => {
      const task = await createTask();

      const file = {
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      } as Express.Multer.File;

      const result = await repository.uploadAttachment(
        task._id.toString(),
        file,
      );

      expect(result.attachments).toHaveLength(1);

      expect(result.attachments[0].filename).toBe('test.pdf');

      expect(result.attachments[0].mime).toBe('application/pdf');

      expect(result.attachments[0].size).toBe(1024);

      expect(result.attachments[0].url).toBe('/uploads/test.pdf');

      expect(result.attachments[0]._id).toBeDefined();
    });

    it('should throw when uploading to a non-existing task', async () => {
      const file = {
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      } as Express.Multer.File;

      await expect(
        repository.uploadAttachment(new Types.ObjectId().toString(), file),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should return attachments for an existing task', async () => {
      const task = await createTask();

      task.attachments.push({
        filename: 'image.png',
        mime: 'image/png',
        size: 2048,
        url: '/uploads/image.png',
      });

      await task.save();

      const result = await repository.getAttachments(task._id.toString());

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].filename).toBe('image.png');
    });

    it('should throw when getting attachments for a missing task', async () => {
      await expect(
        repository.getAttachments(new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should delete an attachment', async () => {
      const task = await createTask();

      task.attachments.push({
        filename: 'delete-me.pdf',
        mime: 'application/pdf',
        size: 1000,
        url: '/uploads/delete-me.pdf',
      });

      await task.save();

      const attachmentId = task.attachments[0]._id!.toString();

      const result = await repository.deleteAttachment(
        task._id.toString(),
        attachmentId,
      );

      expect(result.attachments).toHaveLength(0);
    });

    it('should throw when deleting a missing attachment', async () => {
      const task = await createTask();

      await expect(
        repository.deleteAttachment(
          task._id.toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw when deleting an attachment from a missing task', async () => {
      await expect(
        repository.deleteAttachment(
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // COMMENTS
  // ---------------------------------------------------------------------------

  describe('comments', () => {
    it('should add a comment', async () => {
      const task = await createTask();

      const result = await repository.addComment(
        task._id.toString(),
        {
          body: 'This is an integration test comment.',
        },
        ownerId.toString(),
      );

      expect(result.comments).toHaveLength(1);

      expect(result.comments[0].body).toBe(
        'This is an integration test comment.',
      );

      expect(result.comments[0].author.toString()).toBe(ownerId.toString());

      expect(result.comments[0].createdAt).toBeDefined();
    });

    it('should throw when adding a comment to a missing task', async () => {
      await expect(
        repository.addComment(
          new Types.ObjectId().toString(),
          {
            body: 'Comment',
          },
          ownerId.toString(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should return comments for a task', async () => {
      const task = await createTask();

      task.comments.push({
        author: ownerId,
        body: 'First comment',
        createdAt: new Date(),
      });

      task.comments.push({
        author: otherUserId,
        body: 'Second comment',
        createdAt: new Date(),
      });

      await task.save();

      const result = await repository.getComments(task._id.toString());

      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].body).toBe('First comment');
      expect(result.comments[1].body).toBe('Second comment');
    });

    it('should throw when getting comments for a missing task', async () => {
      await expect(
        repository.getComments(new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // ASSIGN USERS
  // ---------------------------------------------------------------------------

  describe('assignUsers()', () => {
    it('should assign users to a task', async () => {
      const task = await createTask();

      const result = await repository.assignUsers(task._id.toString(), [
        ownerId.toString(),
        otherUserId.toString(),
      ]);

      expect(result.assignees).toHaveLength(2);

      expect(result.assignees.map((id) => id.toString())).toEqual([
        ownerId.toString(),
        otherUserId.toString(),
      ]);
    });

    it('should replace existing assignees', async () => {
      const task = await createTask({
        assignees: [ownerId],
      });

      const result = await repository.assignUsers(task._id.toString(), [
        otherUserId.toString(),
      ]);

      expect(result.assignees).toHaveLength(1);

      expect(result.assignees[0].toString()).toBe(otherUserId.toString());
    });

    it('should throw for a missing task', async () => {
      await expect(
        repository.assignUsers(new Types.ObjectId().toString(), [
          ownerId.toString(),
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // SAVE
  // ---------------------------------------------------------------------------

  describe('save()', () => {
    it('should persist a modified task document', async () => {
      const task = await createTask();

      task.title = 'Modified Through Save';

      const result = await repository.save(task);

      expect(result.title).toBe('Modified Through Save');

      const persisted = await taskModel.findById(task._id);

      expect(persisted!.title).toBe('Modified Through Save');
    });
  });

  // ---------------------------------------------------------------------------
  // STATS
  // ---------------------------------------------------------------------------

  describe('getStats()', () => {
    beforeEach(async () => {
      await createTask({
        status: TaskStatus.Pending,
        priority: TaskPriority.Low,
        dueDate: new Date('2026-12-01'),
      });

      await createTask({
        status: TaskStatus.In_Progress,
        priority: TaskPriority.Medium,
        dueDate: new Date('2026-12-01'),
      });

      await createTask({
        status: TaskStatus.Done,
        priority: TaskPriority.High,
        dueDate: new Date('2026-12-01'),
      });

      await createTask({
        status: TaskStatus.Pending,
        priority: TaskPriority.High,
        dueDate: new Date('2020-01-01'),
      });
    });

    it('should return statistics for a normal user', async () => {
      const result: any = await repository.getStats(ownerId.toString(), 'user');

      expect(result).toBeDefined();

      expect(result.status).toBeDefined();
      expect(result.priority).toBeDefined();

      expect(result.status[TaskStatus.Pending]).toBe(2);
      expect(result.status[TaskStatus.In_Progress]).toBe(1);
      expect(result.status[TaskStatus.Done]).toBe(1);

      expect(result.priority[TaskPriority.Low]).toBe(1);
      expect(result.priority[TaskPriority.Medium]).toBe(1);
      expect(result.priority[TaskPriority.High]).toBe(2);

      expect(result.overdue).toBe(1);
    });

    it('should return statistics across all users for admin', async () => {
      await createTask({
        owner: otherUserId,
        status: TaskStatus.Done,
      });

      const result: any = await repository.getStats(
        adminId.toString(),
        'admin',
      );

      expect(result.status[TaskStatus.Done]).toBe(2);
    });

    it('should use cached statistics on repeated calls', async () => {
      const first: any = await repository.getStats(ownerId.toString(), 'user');

      const second: any = await repository.getStats(ownerId.toString(), 'user');

      expect(second).toEqual(first);
      expect(cacheManager.get).toHaveBeenCalled();
    });

    it('should ignore deleted tasks in statistics', async () => {
      await createTask({
        status: TaskStatus.Done,
        isDeleted: true,
      } as any);

      const result: any = await repository.getStats(ownerId.toString(), 'user');

      expect(result.status[TaskStatus.Done]).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // AGGREGATE WORKSPACE TASKS
  // ---------------------------------------------------------------------------

  describe('aggregateWorkspaceTasks()', () => {
    it('should aggregate workspace tasks', async () => {
      await createTask({
        title: 'High Task',
        priority: TaskPriority.High,
        dueDate: new Date('2026-08-25'),
      });

      await createTask({
        title: 'Low Task',
        priority: TaskPriority.Low,
        dueDate: new Date('2026-08-20'),
      });

      const result = await repository.aggregateWorkspaceTasks(
        workspaceId.toString(),
        1,
        10,
      );

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.stats).toBeDefined();
    });

    it('should filter aggregated tasks by status', async () => {
      await createTask({
        title: 'Pending Task',
        status: TaskStatus.Pending,
      });

      await createTask({
        title: 'Done Task',
        status: TaskStatus.Done,
      });

      const result = await repository.aggregateWorkspaceTasks(
        workspaceId.toString(),
        1,
        10,
        TaskStatus.Done,
      );

      expect(result.total).toBe(1);
      expect(result.data[0].title).toBe('Done Task');
    });

    it('should filter aggregated tasks by search', async () => {
      await createTask({
        title: 'NestJS Integration Task UniqueNestJSIntegrationSearch',
      });

      await createTask({
        title: 'Random Task',
      });

      const result = await repository.aggregateWorkspaceTasks(
        workspaceId.toString(),
        1,
        10,
        undefined,
        'UniqueNestJSIntegrationSearch',
      );

      expect(result.total).toBe(1);
      expect(result.data[0].title).toBe(
        'NestJS Integration Task UniqueNestJSIntegrationSearch',
      );
    });

    it('should support aggregation pagination', async () => {
      await createTask({
        title: 'Task 1',
      });

      await createTask({
        title: 'Task 2',
      });

      await createTask({
        title: 'Task 3',
      });

      const result = await repository.aggregateWorkspaceTasks(
        workspaceId.toString(),
        2,
        1,
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it('should not include deleted tasks', async () => {
      await createTask({
        title: 'Visible Task',
      });

      await createTask({
        title: 'Deleted Task',
        isDeleted: true,
      } as any);

      const result = await repository.aggregateWorkspaceTasks(
        workspaceId.toString(),
        1,
        10,
      );

      expect(result.total).toBe(1);
      expect(result.data[0].title).toBe('Visible Task');
    });

    it('should not include tasks from another workspace', async () => {
      await createTask({
        title: 'Current Workspace Task',
      });

      await createTask({
        title: 'Other Workspace Task',
        workspace: otherWorkspaceId,
      });

      const result = await repository.aggregateWorkspaceTasks(
        workspaceId.toString(),
        1,
        10,
      );

      expect(result.total).toBe(1);
      expect(result.data[0].title).toBe('Current Workspace Task');
    });
  });

  // ---------------------------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------------------------

  describe('findAllForExport()', () => {
    it('should return all non-deleted tasks for a workspace', async () => {
      await createTask({
        title: 'Export Task 1',
      });

      await createTask({
        title: 'Export Task 2',
      });

      await createTask({
        title: 'Deleted Export Task',
        isDeleted: true,
      } as any);

      const result = await repository.findAllForExport(workspaceId.toString());

      expect(result).toHaveLength(2);

      expect(result.some((task) => task.title === 'Deleted Export Task')).toBe(
        false,
      );
    });

    it('should not export tasks from another workspace', async () => {
      await createTask({
        title: 'Current Workspace',
      });

      await createTask({
        title: 'Other Workspace',
        workspace: otherWorkspaceId,
      });

      const result = await repository.findAllForExport(workspaceId.toString());

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Current Workspace');
    });

    it('should exclude __v from exported documents', async () => {
      await createTask({
        title: 'Export Version Test',
      });

      const result = await repository.findAllForExport(workspaceId.toString());

      expect(result[0].__v).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // WORKSPACE ISOLATION
  // ---------------------------------------------------------------------------

  describe('workspace isolation', () => {
    it('should prevent reading another workspace task', async () => {
      const task = await createTask({
        workspace: otherWorkspaceId,
      });

      const result = await repository.findById(
        task._id.toString(),
        workspaceId.toString(),
      );

      expect(result).toBeNull();
    });

    it('should prevent updating another workspace task', async () => {
      const task = await createTask({
        workspace: otherWorkspaceId,
      });

      const result = await repository.update(
        task._id.toString(),
        workspaceId.toString(),
        {
          title: 'Unauthorized Update',
        },
      );

      expect(result).toBeNull();
    });

    it('should prevent deleting another workspace task', async () => {
      const task = await createTask({
        workspace: otherWorkspaceId,
      });

      await repository.delete(task._id.toString(), workspaceId.toString());

      const persisted = await taskModel.findById(task._id);

      expect(persisted!.isDeleted).toBe(false);
    });

    it('should prevent another workspace task from appearing in findAll', async () => {
      await createTask({
        title: 'Correct Workspace',
        workspace: workspaceId,
      });

      await createTask({
        title: 'Wrong Workspace',
        workspace: otherWorkspaceId,
      });

      const result: any = await repository.findAll(
        ownerId.toString(),
        'admin',
        workspaceId.toString(),
        {},
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Correct Workspace');
    });
  });

  // ---------------------------------------------------------------------------
  // CACHE INVALIDATION
  // ---------------------------------------------------------------------------

  describe('cache behavior', () => {
    it('should cache findAll results', async () => {
      await createTask();

      const query = {
        page: 1,
        limit: 10,
      };

      await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        query,
      );

      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should clear tracked task cache keys', async () => {
      await createTask();

      await repository.findAll(
        ownerId.toString(),
        'user',
        workspaceId.toString(),
        {},
      );

      await repository.clearCache();

      expect(cacheManager.del).toHaveBeenCalled();
    });
  });
});
