import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Connection, Model, Types } from 'mongoose';
import { createIntegrationApp } from '../setup/test-app.factory';
import { clearDatabase } from '../setup/database';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { clearRedis } from '../setup/redis';

// ============================================================
// COMMANDS
// ============================================================

import { CreateTaskCommand } from '../../../src/task/application/commands/create-task/create-task.command';
import { UpdateTaskCommand } from '../../../src/task/application/commands/update-task/update-task.command';
import { DeleteTaskCommand } from '../../../src/task/application/commands/delete-task/delete-task.command';
import { AssignTaskCommand } from '../../../src/task/application/commands/assign-task/assign-task.command';
import { CreateCommentCommand } from '../../../src/task/application/commands/create-comment/create-comment.command';
import { UploadAttachmentCommand } from '../../../src/task/application/commands/upload-attachment/upload-attachment.command';
import { DeleteAttachmentCommand } from '../../../src/task/application/commands/delete-attachment/delete-attachment.command';

// ============================================================
// QUERIES
// ============================================================

import { GetTaskByIdQuery } from '../../../src/task/application/queries/get-task-by-id/get-task-by-id.query';
import { GetTasksQuery } from '../../../src/task/application/queries/get-tasks/get-tasks.query';
import { GetTaskStatsQuery } from '../../../src/task/application/queries/get-task-stats/get-task-stats.query';
import { GetCommentsQuery } from '../../../src/task/application/queries/get-comments/get-comments.query';
import { GetAttachmentsQuery } from '../../../src/task/application/queries/get-attachments/get-attachments.query';

// ============================================================
// SCHEMAS
// ============================================================

import { User, UserDocument } from '../../../src/users/Schema/user.schema';

import { Task, TaskDocument } from '../../../src/task/Schema/task.schema';

import {
  MembershipDocument,
  Membership,
} from 'src/workspace/infrastructure/persistence/schemas/membership.schema';
import {
  Workspace,
  WorkspaceDocument,
} from 'src/workspace/infrastructure/persistence/schemas/workspace.schema';

import {
  Activity,
  ActivityDocument,
} from '../../../src/activity/Schema/activity.schema';

import {
  AuditLog,
  AuditLogDocument,
} from '../../../src/audit/schema/audit-log.schema';

import {
  OutboxEvent,
  OutboxEventDocument,
} from '../../../src/outbox/schema/outbox-event.schema';

// ============================================================
// ENUMS
// ============================================================

import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { TaskStatus } from '../../../src/task/Enums/task-status.enum';
import { TaskPriority } from '../../../src/task/Enums/task-priority.enum';

// ============================================================
// TEST
// ============================================================

describe('Task Handlers Integration', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  let commandBus: CommandBus;
  let queryBus: QueryBus;

  let userModel: Model<UserDocument>;
  let taskModel: Model<TaskDocument>;
  let workspaceModel: Model<WorkspaceDocument>;
  let membershipModel: Model<MembershipDocument>;
  let activityModel: Model<ActivityDocument>;
  let auditLogModel: Model<AuditLogDocument>;
  let outboxEventModel: Model<OutboxEventDocument>;

  let ownerId: string;
  let memberId: string;
  let workspaceId: string;

  beforeAll(async () => {
    app = await createIntegrationApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    commandBus = app.get(CommandBus);
    queryBus = app.get(QueryBus);

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    taskModel = app.get<Model<TaskDocument>>(getModelToken(Task.name));

    workspaceModel = app.get<Model<WorkspaceDocument>>(
      getModelToken(Workspace.name),
    );

    membershipModel = app.get<Model<MembershipDocument>>(
      getModelToken(Membership.name),
    );

    activityModel = app.get<Model<ActivityDocument>>(
      getModelToken(Activity.name),
    );

    auditLogModel = app.get<Model<AuditLogDocument>>(
      getModelToken(AuditLog.name),
    );

    outboxEventModel = app.get<Model<OutboxEventDocument>>(
      getModelToken(OutboxEvent.name),
    );
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();

    await seedUsersAndWorkspace();
  }, 30000);

  afterAll(async () => {
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // ============================================================
  // TEST DATA
  // ============================================================

  async function seedUsersAndWorkspace() {
    const owner = await userModel.create({
      email: `task-owner-${Date.now()}@example.com`,
      password: 'Password123',
      emailVerified: true,
      role: 'user',
    });

    const member = await userModel.create({
      email: `task-member-${Date.now()}@example.com`,
      password: 'Password123',
      emailVerified: true,
      role: 'user',
    });

    ownerId = owner._id.toString();
    memberId = member._id.toString();

    const workspace = await workspaceModel.create({
      name: 'Task Integration Workspace',
      slug: 'task-integration-workspace',
      owner: owner._id,
    });

    workspaceId = workspace._id.toString();

    await membershipModel.create([
      {
        workspaceId: workspace._id,
        userId: owner._id,
        role: WorkspaceRole.OWNER,
      },
      {
        workspaceId: workspace._id,
        userId: member._id,
        role: WorkspaceRole.MEMBER,
      },
    ]);
  }

  async function createTask(
    overrides: Record<string, unknown> = {},
  ): Promise<TaskDocument> {
    const task = await taskModel.create({
      title: 'Integration Test Task',
      description: 'Integration test task',
      owner: new Types.ObjectId(ownerId),
      workspace: new Types.ObjectId(workspaceId),
      status: TaskStatus.Pending,
      priority: TaskPriority.Medium,
      isDeleted: false,
      ...overrides,
    });

    return task;
  }

  // ============================================================
  // CREATE TASK
  // ============================================================

  describe('CreateTaskHandler', () => {
    it('should create a task and persist activity, outbox and audit records', async () => {
      const command = new CreateTaskCommand(
        {
          title: 'Created By Handler',
          description: 'Integration test',
          priority: TaskPriority.Medium,
          workspaceId,
        } as any,
        ownerId,
      );

      const result = await commandBus.execute(command);

      expect(result).toBeDefined();
      expect(result.title).toBe('Created By Handler');

      const task = await taskModel.findById(result._id).lean();

      expect(task).toBeDefined();
      expect(task!.workspace.toString()).toBe(workspaceId);
      expect(task!.owner.toString()).toBe(ownerId);

      const activity = await activityModel
        .findOne({
          task: result._id,
          action: 'CREATED',
        })
        .lean();

      expect(activity).toBeDefined();

      const outboxEvent = await outboxEventModel
        .findOne({
          eventType: 'TASK_CREATED',
          aggregateType: 'TASK',
          aggregateId: new Types.ObjectId(result._id),
        })
        .lean();

      expect(outboxEvent).toBeDefined();

      if (!outboxEvent) {
        throw new Error(
          `Expected TASK_CREATED outbox event for task ${result._id.toString()}`,
        );
      }

      expect(outboxEvent.payload.taskId).toBe(result._id.toString());

      expect(outboxEvent.payload.title).toBe('Created By Handler');

      const audit = await auditLogModel
        .findOne({
          actorId: new Types.ObjectId(ownerId),
          action: 'TASK_CREATED',
          resource: 'TASK',
          workspaceId: new Types.ObjectId(workspaceId),
        })
        .lean();

      expect(audit).toBeDefined();
    });

    it('should reject task creation by a non-member', async () => {
      const outsider = await userModel.create({
        email: `outsider-${Date.now()}@example.com`,
        password: 'Password123',
        emailVerified: true,
        role: 'user',
      });

      await expect(
        commandBus.execute(
          new CreateTaskCommand(
            {
              title: 'Unauthorized Task',
              description: 'Should fail',
              priority: TaskPriority.Medium,
              workspaceId,
            } as any,
            outsider._id.toString(),
          ),
        ),
      ).rejects.toThrow('You are not a member of this workspace');

      const task = await taskModel.findOne({
        title: 'Unauthorized Task',
      });

      expect(task).toBeNull();
    });
  });

  // ============================================================
  // GET TASKS
  // ============================================================

  describe('GetTasksHandler', () => {
    it('should return tasks for a workspace member', async () => {
      await createTask({
        title: 'Task One',
      });

      await createTask({
        title: 'Task Two',
      });

      const result = await queryBus.execute(
        new GetTasksQuery(ownerId, 'OWNER', workspaceId, {} as any),
      );

      expect(result).toBeDefined();
    });

    it('should reject a user who is not a workspace member', async () => {
      const outsider = await userModel.create({
        email: `get-tasks-outsider-${Date.now()}@example.com`,
        password: 'Password123',
        emailVerified: true,
        role: 'user',
      });

      await expect(
        queryBus.execute(
          new GetTasksQuery(
            outsider._id.toString(),
            'MEMBER',
            workspaceId,
            {} as any,
          ),
        ),
      ).rejects.toThrow('You are not a member of this workspace');
    });
  });

  // ============================================================
  // GET TASK BY ID
  // ============================================================

  describe('GetTaskByIdHandler', () => {
    it('should return an authorized task', async () => {
      const task = await createTask();

      const result = await queryBus.execute(
        new GetTaskByIdQuery(
          task._id.toString(),
          ownerId,
          'OWNER',
          workspaceId,
        ),
      );

      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(task._id.toString());
    });
  });

  // ============================================================
  // GET TASK STATS
  // ============================================================

  describe('GetTaskStatsHandler', () => {
    it('should return task statistics', async () => {
      await createTask({
        status: TaskStatus.Pending,
      });

      await createTask({
        title: 'Completed Task',
        status: TaskStatus.Done,
      });

      const result = await queryBus.execute(
        new GetTaskStatsQuery(ownerId, 'OWNER'),
      );

      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // UPDATE TASK
  // ============================================================

  describe('UpdateTaskHandler', () => {
    it('should update a task and persist activity and audit records', async () => {
      const task = await createTask({
        title: 'Original Title',
      });

      const expectedVersion = task.__v;

      const result = await commandBus.execute(
        new UpdateTaskCommand(
          task._id.toString(),
          {
            title: 'Updated Title',
          } as any,
          ownerId,
          'OWNER',
          workspaceId,
          expectedVersion,
        ),
      );

      expect(result).toBeDefined();

      const updated = await taskModel.findById(task._id).lean();

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated Title');

      const activity = await activityModel
        .findOne({
          task: task._id,
          action: 'UPDATED',
        })
        .lean();

      expect(activity).toBeDefined();

      const audit = await auditLogModel
        .findOne({
          actorId: ownerId,
          action: 'TASK_UPDATED',
          resource: 'TASK',
          workspaceId,
        })
        .lean();

      expect(audit).toBeDefined();
    });

    it('should reject an update with a stale version', async () => {
      const task = await createTask({
        title: 'Version Test',
      });

      await expect(
        commandBus.execute(
          new UpdateTaskCommand(
            task._id.toString(),
            {
              title: 'Should Fail',
            } as any,
            ownerId,
            'OWNER',
            workspaceId,
            task.__v + 100,
          ),
        ),
      ).rejects.toThrow(
        'Task has been modified. Please refresh and try again.',
      );

      const unchanged = await taskModel.findById(task._id).lean();

      expect(unchanged!.title).toBe('Version Test');
    });

    it('should create TASK_COMPLETED audit when status changes to done', async () => {
      const task = await createTask({
        status: TaskStatus.Pending,
      });

      await commandBus.execute(
        new UpdateTaskCommand(
          task._id.toString(),
          {
            status: TaskStatus.Done,
          } as any,
          ownerId,
          'OWNER',
          workspaceId,
          task.__v,
        ),
      );

      const audit = await auditLogModel
        .findOne({
          actorId: ownerId,
          action: 'TASK_COMPLETED',
          resource: 'TASK',
          workspaceId,
        })
        .lean();

      expect(audit).toBeDefined();
    });
  });

  // ============================================================
  // DELETE TASK
  // ============================================================

  describe('DeleteTaskHandler', () => {
    it('should soft delete a task and persist activity/audit', async () => {
      const task = await createTask();

      const result = await commandBus.execute(
        new DeleteTaskCommand(
          task._id.toString(),
          ownerId,
          'OWNER',
          workspaceId,
        ),
      );

      expect(result).toEqual({
        message: 'Task Deleted Successfully!',
      });

      const deleted = await taskModel.findById(task._id).lean();

      expect(deleted).toBeDefined();
      expect(deleted!.isDeleted).toBe(true);
      expect(deleted!.deletedAt).toBeDefined();

      const activity = await activityModel
        .findOne({
          task: task._id,
          action: 'DELETED',
        })
        .lean();

      expect(activity).toBeDefined();

      const audit = await auditLogModel
        .findOne({
          actorId: new Types.ObjectId(ownerId),
          action: 'TASK_DELETED',
          resource: 'TASK',
          workspaceId: new Types.ObjectId(workspaceId),
        })
        .lean();

      expect(audit).toBeDefined();

      if (!audit) {
        throw new Error('Expected TASK_DELETED audit log to exist');
      }

      expect(audit.meta?.deletionType).toBe('soft_delete');
    });
  });

  // ============================================================
  // ASSIGN TASK
  // ============================================================

  describe('AssignTaskHandler', () => {
    it('should assign a workspace member to a task', async () => {
      const task = await createTask();

      const result = await commandBus.execute(
        new AssignTaskCommand(task._id.toString(), ownerId, workspaceId, {
          userIds: [memberId],
        } as any),
      );

      expect(result).toBeDefined();

      const updated = await taskModel.findById(task._id).lean();

      expect(updated).toBeDefined();

      const assigneeIds = (updated as any).assignees ?? [];

      expect(assigneeIds.some((id: any) => id.toString() === memberId)).toBe(
        true,
      );

      const audit = await auditLogModel
        .findOne({
          actorId: new Types.ObjectId(ownerId),
          action: 'TASK_ASSIGNED',
          resource: 'TASK',
          workspaceId: new Types.ObjectId(workspaceId),
        })
        .lean();

      expect(audit).toBeDefined();

      if (!audit) {
        throw new Error('Expected TASK_ASSIGNED audit log to exist');
      }

      expect(audit.meta?.taskId).toBe(task._id.toString());
    });

    it('should reject assigning a non-member', async () => {
      const task = await createTask();

      const outsider = await userModel.create({
        email: `assign-outsider-${Date.now()}@example.com`,
        password: 'Password123',
        emailVerified: true,
        role: 'user',
      });

      await expect(
        commandBus.execute(
          new AssignTaskCommand(task._id.toString(), ownerId, workspaceId, {
            userIds: [outsider._id.toString()],
          } as any),
        ),
      ).rejects.toThrow(
        `User ${outsider._id.toString()} is not a member of this workspace`,
      );
    });

    it('should reject assignment by a normal member', async () => {
      const task = await createTask();

      await expect(
        commandBus.execute(
          new AssignTaskCommand(task._id.toString(), memberId, workspaceId, {
            userIds: [ownerId],
          } as any),
        ),
      ).rejects.toThrow('You are not allowed to assign tasks');
    });
  });

  // ============================================================
  // CREATE COMMENT
  // ============================================================

  describe('CreateCommentHandler', () => {
    it('should create a comment and persist activity and audit', async () => {
      const task = await createTask();

      const result = await commandBus.execute(
        new CreateCommentCommand(
          task._id.toString(),
          {
            body: 'Integration test comment',
          } as any,
          ownerId,
          'OWNER',
          workspaceId,
        ),
      );

      expect(result).toBeDefined();

      const updated = await taskModel.findById(task._id).lean();

      expect(updated).toBeDefined();

      expect((updated as any).comments?.length).toBeGreaterThan(0);

      const activity = await activityModel
        .findOne({
          task: task._id,
          action: 'COMMENT_ADDED',
        })
        .lean();

      expect(activity).toBeDefined();

      const audit = await auditLogModel
        .findOne({
          actorId: ownerId,
          action: 'COMMENT_CREATED',
          resource: 'COMMENT',
          workspaceId,
        })
        .lean();

      expect(audit).toBeDefined();
    });
  });

  // ============================================================
  // GET COMMENTS
  // ============================================================

  describe('GetCommentsHandler', () => {
    it('should return task comments', async () => {
      const task = await createTask();

      await commandBus.execute(
        new CreateCommentCommand(
          task._id.toString(),
          {
            body: 'First comment',
          } as any,
          ownerId,
          'OWNER',
          workspaceId,
        ),
      );

      const result = await queryBus.execute(
        new GetCommentsQuery(
          task._id.toString(),
          ownerId,
          'OWNER',
          workspaceId,
        ),
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // UPLOAD ATTACHMENT
  // ============================================================

  describe('UploadAttachmentHandler', () => {
    it('should upload an attachment and persist activity/audit', async () => {
      const task = await createTask({
        attachments: [],
      });

      const file = {
        fieldname: 'file',
        originalname: 'integration.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 20,
        buffer: Buffer.from('integration test attachment'),
        destination: '',
        filename: 'integration.txt',
        path: '',
        stream: undefined,
      } as any;

      const result = await commandBus.execute(
        new UploadAttachmentCommand(
          task._id.toString(),
          file,
          ownerId,
          'OWNER',
          workspaceId,
        ),
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      const activity = await activityModel
        .findOne({
          task: task._id,
          action: 'ATTACHMENT_ADDED',
        })
        .lean();

      expect(activity).toBeDefined();

      const audit = await auditLogModel
        .findOne({
          actorId: ownerId,
          action: 'ATTACHMENT_ADDED',
          resource: 'ATTACHMENT',
          workspaceId,
        })
        .lean();

      expect(audit).toBeDefined();

      const updated = await taskModel.findById(task._id).lean();

      expect(updated!.attachments.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // GET ATTACHMENTS
  // ============================================================

  describe('GetAttachmentsHandler', () => {
    it('should return task attachments', async () => {
      const attachmentId = new Types.ObjectId();

      const task = await createTask({
        attachments: [
          {
            _id: attachmentId,
            filename: 'test.txt',
            originalName: 'test.txt',
            mime: 'text/plain',
            size: 10,
            url: 'uploads/test.txt',
          },
        ],
      });

      const result = await queryBus.execute(
        new GetAttachmentsQuery(
          task._id.toString(),
          ownerId,
          'OWNER',
          workspaceId,
        ),
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(1);

      expect(result[0]._id.toString()).toBe(attachmentId.toString());
    });
  });

  // ============================================================
  // DELETE ATTACHMENT
  // ============================================================

  describe('DeleteAttachmentHandler', () => {
    it('should delete an attachment and persist activity/audit', async () => {
      const attachmentId = new Types.ObjectId();

      const task = await createTask({
        attachments: [
          {
            _id: attachmentId,
            filename: 'delete-me.txt',
            originalName: 'delete-me.txt',
            mime: 'text/plain',
            size: 10,
            url: 'uploads/delete-me.txt',
          },
        ],
      });

      const result = await commandBus.execute(
        new DeleteAttachmentCommand(
          task._id.toString(),
          attachmentId.toString(),
          ownerId,
          'OWNER',
          workspaceId,
        ),
      );

      expect(result).toEqual({
        message: 'Attachment deleted successfully.',
      });

      const updated = await taskModel.findById(task._id).lean();

      expect(updated).toBeDefined();

      expect(
        updated!.attachments.some(
          (attachment: any) =>
            attachment._id.toString() === attachmentId.toString(),
        ),
      ).toBe(false);

      const activity = await activityModel
        .findOne({
          task: task._id,
          action: 'ATTACHMENT_DELETED',
        })
        .lean();

      expect(activity).toBeDefined();

      const audit = await auditLogModel
        .findOne({
          actorId: ownerId,
          action: 'ATTACHMENT_DELETED',
          resource: 'ATTACHMENT',
          workspaceId,
        })
        .lean();

      expect(audit).toBeDefined();
    });

    it('should reject deleting an attachment that does not exist', async () => {
      const task = await createTask({
        attachments: [],
      });

      const missingAttachmentId = new Types.ObjectId().toString();

      await expect(
        commandBus.execute(
          new DeleteAttachmentCommand(
            task._id.toString(),
            missingAttachmentId,
            ownerId,
            'OWNER',
            workspaceId,
          ),
        ),
      ).rejects.toThrow('Attachment Not Found');
    });
  });
});
