import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { createIntegrationApp } from '../setup/test-app.factory';

import { clearDatabase } from '../setup/database';

import { clearRedis } from '../setup/redis';

import { ReminderService } from '../../../src/reminder/reminder.service';

import { Task, TaskDocument } from '../../../src/task/Schema/task.schema';

import { TaskStatus } from '../../../src/task/Enums/task-status.enum';
import { TaskPriority } from '../../../src/task/Enums/task-priority.enum';

import { User, UserDocument } from '../../../src/users/Schema/user.schema';

import {
  Workspace,
  WorkspaceDocument,
} from '../../../src/workspace/infrastructure/persistence/schemas/workspace.schema';

import { WorkspaceFeatureFlag } from '../../../src/workspace/domain/enums/workspace-feature-flag.enum';

import { FeatureFlagsService } from '../../../src/workspace/application/services/feature-flags.service';

import { EmailDeliveryStatus } from '../../../src/mail/domain/enums/email-delivery-status.enum';

jest.setTimeout(30000);

describe('Reminder Module (integration)', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  let reminderService: ReminderService;

  let taskModel: Model<TaskDocument>;
  let userModel: Model<UserDocument>;
  let workspaceModel: Model<WorkspaceDocument>;

  let featureFlagsService: FeatureFlagsService;

  beforeAll(async () => {
    app = await createIntegrationApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    reminderService = app.get<ReminderService>(ReminderService);

    taskModel = app.get<Model<TaskDocument>>(getModelToken(Task.name));

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    workspaceModel = app.get<Model<WorkspaceDocument>>(
      getModelToken(Workspace.name),
    );

    featureFlagsService = app.get<FeatureFlagsService>(FeatureFlagsService);
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();

    jest.restoreAllMocks();
  }, 30000);

  afterAll(async () => {
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // =========================================================================
  // HELPERS
  // =========================================================================

  async function createTestUser(
    overrides: Partial<UserDocument> = {},
  ): Promise<UserDocument> {
    return userModel.create({
      _id: new Types.ObjectId(),

      email:
        overrides.email ??
        `reminder-${new Types.ObjectId().toString()}@example.com`,

      password: overrides.password ?? 'hashed-password',

      ...overrides,
    });
  }

  async function createTestWorkspace(
    ownerId: Types.ObjectId,
    overrides: Partial<WorkspaceDocument> = {},
  ): Promise<WorkspaceDocument> {
    const workspaceId = new Types.ObjectId();

    return workspaceModel.create({
      _id: workspaceId,

      name:
        overrides.name ??
        `Reminder Integration Workspace ${workspaceId.toString()}`,

      slug: overrides.slug ?? `reminder-integration-${workspaceId.toString()}`,

      owner: ownerId,

      ...overrides,
    });
  }

  async function createTestTask(
    userId: Types.ObjectId,
    workspaceId: Types.ObjectId,
    overrides: Partial<TaskDocument> = {},
  ): Promise<TaskDocument> {
    return taskModel.create({
      _id: new Types.ObjectId(),

      title: overrides.title ?? 'Reminder integration task',

      description:
        overrides.description ?? 'Task used by Reminder integration tests',

      status: overrides.status ?? TaskStatus.Pending,

      priority: overrides.priority ?? TaskPriority.Medium,

      dueDate: overrides.dueDate ?? new Date(Date.now() + 2 * 60 * 60 * 1000),

      owner: overrides.owner ?? userId,

      workspace: overrides.workspace ?? workspaceId,

      isDeleted: overrides.isDeleted ?? false,

      reminderSent: overrides.reminderSent ?? false,

      tags: overrides.tags ?? [],

      comments: overrides.comments ?? [],

      attachments: overrides.attachments ?? [],

      assignees: overrides.assignees ?? [],

      ...overrides,
    });
  }

  async function createReminderFixture() {
    const user = await createTestUser({
      email: `owner-${new Types.ObjectId().toString()}@example.com`,
    });

    const workspace = await createTestWorkspace(user._id);

    const task = await createTestTask(user._id, workspace._id);

    return {
      user,
      workspace,
      task,
    };
  }

  // =========================================================================
  // SERVICE AVAILABILITY
  // =========================================================================

  describe('ReminderService', () => {
    it('is registered in the application', () => {
      expect(reminderService).toBeDefined();
    });

    // =======================================================================
    // HAPPY PATH
    // =======================================================================

    it('creates an email delivery and outbox event for an eligible task', async () => {
      const { workspace, task } = await createReminderFixture();

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(1);

      expect(deliveries[0]).toMatchObject({
        to: expect.stringContaining('@example.com'),

        emailType: 'TASK_REMINDER',

        status: EmailDeliveryStatus.QUEUED,
      });

      const outboxEvents = await mongoConnection
        .collection('outboxevents')
        .find({
          aggregateType: 'TASK',

          aggregateId: task._id,

          eventType: 'REMINDER_DUE',

          workspaceId: workspace._id,
        })
        .toArray();

      expect(outboxEvents).toHaveLength(1);

      expect(outboxEvents[0].payload).toMatchObject({
        to: expect.stringContaining('@example.com'),

        taskTitle: task.title,

        priority: task.priority,
      });
    });

    it('marks an eligible task as reminderSent', async () => {
      const { task } = await createReminderFixture();

      expect(task.reminderSent).toBe(false);

      await reminderService.handleCron();

      const updatedTask = await taskModel.findById(task._id);

      expect(updatedTask?.reminderSent).toBe(true);
    });

    // =======================================================================
    // TASK FILTERING
    // =======================================================================

    it('does not create a reminder for a completed task', async () => {
      const user = await createTestUser({
        email: `owner-${new Types.ObjectId().toString()}@example.com`,
      });

      const workspace = await createTestWorkspace(user._id);

      const task = await createTestTask(user._id, workspace._id, {
        status: TaskStatus.Done,
      });

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(0);

      const updatedTask = await taskModel.findById(task._id);

      expect(updatedTask?.reminderSent).toBe(false);
    });

    it('does not create a reminder for a deleted task', async () => {
      const user = await createTestUser({
        email: `owner-${new Types.ObjectId().toString()}@example.com`,
      });

      const workspace = await createTestWorkspace(user._id);

      const task = await createTestTask(user._id, workspace._id, {
        isDeleted: true,
      });

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(0);

      const updatedTask = await taskModel.findById(task._id);

      expect(updatedTask?.reminderSent).toBe(false);
    });

    it('does not create a duplicate reminder when reminderSent is already true', async () => {
      const user = await createTestUser({
        email: `owner-${new Types.ObjectId().toString()}@example.com`,
      });

      const workspace = await createTestWorkspace(user._id);

      const task = await createTestTask(user._id, workspace._id, {
        reminderSent: true,
      });

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(0);

      const updatedTask = await taskModel.findById(task._id);

      expect(updatedTask?.reminderSent).toBe(true);
    });

    it('does not create a reminder for a task due more than 24 hours from now', async () => {
      const user = await createTestUser({
        email: `owner-${new Types.ObjectId().toString()}@example.com`,
      });

      const workspace = await createTestWorkspace(user._id);

      const task = await createTestTask(user._id, workspace._id, {
        dueDate: new Date(Date.now() + 25 * 60 * 60 * 1000),
      });

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(0);

      const updatedTask = await taskModel.findById(task._id);

      expect(updatedTask?.reminderSent).toBe(false);
    });

    it('creates reminders for multiple eligible tasks', async () => {
      const { user, workspace } = await createReminderFixture();

      await createTestTask(user._id, workspace._id, {
        title: 'First reminder task',
      });

      await createTestTask(user._id, workspace._id, {
        title: 'Second reminder task',
      });

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(3);
    });

    // =======================================================================
    // FEATURE FLAGS
    // =======================================================================

    it('creates a reminder when both reminder feature flags use their default enabled values', async () => {
      const { workspace, task } = await createReminderFixture();

      const remindersEnabled = await featureFlagsService.isEnabled(
        workspace._id.toString(),
        WorkspaceFeatureFlag.REMINDERS,
      );

      const emailEnabled = await featureFlagsService.isEnabled(
        workspace._id.toString(),
        WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS,
      );

      expect(remindersEnabled).toBe(true);

      expect(emailEnabled).toBe(true);

      await reminderService.handleCron();

      const updatedTask = await taskModel.findById(task._id);

      expect(updatedTask?.reminderSent).toBe(true);
    });

    it('skips reminders when REMINDERS is disabled', async () => {
      const { workspace, task } = await createReminderFixture();

      await featureFlagsService.updateFlags(workspace._id.toString(), {
        [WorkspaceFeatureFlag.REMINDERS]: false,
      });

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(0);

      const updatedTask = await taskModel.findById(task._id);

      expect(updatedTask?.reminderSent).toBe(false);
    });

    it('skips reminders when EMAIL_NOTIFICATIONS is disabled', async () => {
      const { workspace, task } = await createReminderFixture();

      await featureFlagsService.updateFlags(workspace._id.toString(), {
        [WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS]: false,
      });

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(0);

      const updatedTask = await taskModel.findById(task._id);

      expect(updatedTask?.reminderSent).toBe(false);
    });

    // =======================================================================
    // PERSISTED OUTBOX / DELIVERY DATA
    // =======================================================================

    it('stores the correct reminder payload in the outbox event', async () => {
      const { workspace, task, user } = await createReminderFixture();

      await reminderService.handleCron();

      const outboxEvents = await mongoConnection
        .collection('outboxevents')
        .find({
          eventType: 'REMINDER_DUE',

          aggregateId: task._id,

          workspaceId: workspace._id,
        })
        .toArray();

      expect(outboxEvents).toHaveLength(1);

      const event = outboxEvents[0];

      expect(event.aggregateType).toBe('TASK');

      expect(event.aggregateId).toEqual(task._id);

      expect(event.workspaceId).toEqual(workspace._id);

      expect(event.payload).toMatchObject({
        to: user.email,

        taskTitle: task.title,

        priority: task.priority,
      });

      expect(new Date(event.payload.dueDate).getTime()).toBe(
        task.dueDate.getTime(),
      );
    });

    it('creates exactly one delivery and one outbox event per eligible task', async () => {
      const { task } = await createReminderFixture();

      await reminderService.handleCron();

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      const outboxEvents = await mongoConnection
        .collection('outboxevents')
        .find({
          eventType: 'REMINDER_DUE',

          aggregateId: task._id,
        })
        .toArray();

      expect(deliveries).toHaveLength(1);

      expect(outboxEvents).toHaveLength(1);
    });

    // =======================================================================
    // OWNER EMAIL
    // =======================================================================

    it('uses the task owner email for the email delivery and outbox payload', async () => {
      const user = await createTestUser({
        email: `owner-${new Types.ObjectId().toString()}@example.com`,
      });

      const workspace = await createTestWorkspace(user._id);

      const task = await createTestTask(user._id, workspace._id, {
        title: 'Owner email reminder',
      });

      await reminderService.handleCron();

      const deliveries = await mongoConnection
        .collection('emaildeliveries')
        .find({
          emailType: 'TASK_REMINDER',
        })
        .toArray();

      expect(deliveries).toHaveLength(1);

      expect(deliveries[0].to).toBe(user.email);

      const outboxEvents = await mongoConnection
        .collection('outboxevents')
        .find({
          eventType: 'REMINDER_DUE',

          aggregateId: task._id,
        })
        .toArray();

      expect(outboxEvents).toHaveLength(1);

      expect(outboxEvents[0].payload.to).toBe(user.email);
    });
  });
});
