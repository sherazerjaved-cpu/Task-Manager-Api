import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { AuditLog, AuditLogDocument } from 'src/audit/schema/audit-log.schema';
import { AuditService } from 'src/audit/application/audit.service';
import { GetWorkspaceAuditLogsHandler } from 'src/audit/application/queries/get-workspace-audit-logs/get-workspace-audit-logs.handler';
import { GetWorkspaceAuditLogsQuery } from 'src/audit/application/queries/get-workspace-audit-logs/get-workspace-audit-logs.query';

import { createIntegrationApp } from '../setup/test-app.factory';
import { clearDatabase } from '../setup/database';

describe('Audit Integration', () => {
  let app: INestApplication;
  let connection: Connection;

  let auditService: AuditService;
  let auditHandler: GetWorkspaceAuditLogsHandler;
  let auditLogModel: Model<AuditLogDocument>;

  const workspaceId = new Types.ObjectId();
  const otherWorkspaceId = new Types.ObjectId();

  const userId = new Types.ObjectId();
  const otherUserId = new Types.ObjectId();

  beforeAll(async () => {
    app = await createIntegrationApp();

    connection = app.get<Connection>(getConnectionToken());

    auditService = app.get(AuditService);

    auditHandler = app.get(GetWorkspaceAuditLogsHandler);

    auditLogModel = app.get(getModelToken(AuditLog.name));
  });

  beforeEach(async () => {
    await clearDatabase(connection);
  });

  afterAll(async () => {
    await shutdownIntegrationApp(app, connection);
  }, 30000);

  describe('AuditService', () => {
    it('should persist an audit log', async () => {
      await auditService.log({
        actorId: userId.toString(),
        action: 'TASK_CREATED',
        resource: 'TASK',
        workspaceId: workspaceId.toString(),
        ip: '127.0.0.1',
        meta: {
          taskId: 'task-123',
          title: 'Test task',
        },
      });

      const audit = await auditLogModel
        .findOne({
          actorId: userId,
          action: 'TASK_CREATED',
          resource: 'TASK',
          workspaceId,
        })
        .lean();

      expect(audit).toBeDefined();

      expect(audit?.actorId?.toString()).toBe(userId.toString());

      expect(audit?.workspaceId?.toString()).toBe(workspaceId.toString());

      expect(audit?.action).toBe('TASK_CREATED');
      expect(audit?.resource).toBe('TASK');
      expect(audit?.ip).toBe('127.0.0.1');

      expect(audit?.meta).toEqual({
        taskId: 'task-123',
        title: 'Test task',
      });
    });

    it('should redact sensitive metadata', async () => {
      await auditService.log({
        actorId: userId.toString(),
        action: 'USER_LOGIN',
        resource: 'USER',
        workspaceId: workspaceId.toString(),
        meta: {
          email: 'user@example.com',
          password: 'Password123',
          accessToken: 'secret-access-token',
          refresh_token: 'secret-refresh-token',
          apiKey: 'secret-api-key',
          authorization: 'Bearer secret',
          normalValue: 'should-remain',
        },
      });

      const audit = await auditLogModel
        .findOne({
          action: 'USER_LOGIN',
          resource: 'USER',
        })
        .lean();

      expect(audit).toBeDefined();

      expect(audit?.meta).toEqual({
        email: 'user@example.com',
        password: '[REDACTED]',
        accessToken: '[REDACTED]',
        refresh_token: '[REDACTED]',
        apiKey: '[REDACTED]',
        authorization: '[REDACTED]',
        normalValue: 'should-remain',
      });
    });
  });

  describe('GetWorkspaceAuditLogsHandler', () => {
    beforeEach(async () => {
      await auditLogModel.create([
        {
          actorId: userId,
          action: 'TASK_CREATED',
          resource: 'TASK',
          workspaceId,
          meta: {
            taskId: 'task-1',
          },
        },
        {
          actorId: userId,
          action: 'TASK_UPDATED',
          resource: 'TASK',
          workspaceId,
          meta: {
            taskId: 'task-2',
          },
        },
        {
          actorId: userId,
          action: 'TASK_DELETED',
          resource: 'TASK',
          workspaceId,
          meta: {
            taskId: 'task-3',
          },
        },
        {
          actorId: otherUserId,
          action: 'TASK_CREATED',
          resource: 'TASK',
          workspaceId: otherWorkspaceId,
          meta: {
            taskId: 'other-task',
          },
        },
      ]);
    });

    it('should return audit logs for a workspace', async () => {
      const query = new GetWorkspaceAuditLogsQuery(
        workspaceId.toString(),
        userId.toString(),
        1,
        20,
      );

      const result = await auditHandler.execute(query);

      expect(result).toHaveLength(3);

      expect(
        result.every(
          (audit) => audit.workspaceId?.toString() === workspaceId.toString(),
        ),
      ).toBe(true);
    });

    it('should not return audit logs from another workspace', async () => {
      const query = new GetWorkspaceAuditLogsQuery(
        workspaceId.toString(),
        userId.toString(),
        1,
        20,
      );

      const result = await auditHandler.execute(query);

      expect(result).toHaveLength(3);

      expect(
        result.some(
          (audit) =>
            audit.workspaceId?.toString() === otherWorkspaceId.toString(),
        ),
      ).toBe(false);
    });

    it('should paginate audit logs', async () => {
      const pageOne = await auditHandler.execute(
        new GetWorkspaceAuditLogsQuery(
          workspaceId.toString(),
          userId.toString(),
          1,
          2,
        ),
      );

      const pageTwo = await auditHandler.execute(
        new GetWorkspaceAuditLogsQuery(
          workspaceId.toString(),
          userId.toString(),
          2,
          2,
        ),
      );

      expect(pageOne).toHaveLength(2);
      expect(pageTwo).toHaveLength(1);

      const pageOneIds = pageOne.map((audit) => audit._id.toString());

      const pageTwoIds = pageTwo.map((audit) => audit._id.toString());

      expect(pageOneIds).not.toEqual(expect.arrayContaining(pageTwoIds));
    });

    it('should return audit logs in newest-first order', async () => {
      const result = await auditHandler.execute(
        new GetWorkspaceAuditLogsQuery(
          workspaceId.toString(),
          userId.toString(),
          1,
          20,
        ),
      );

      expect(result).toHaveLength(3);

      const databaseLogs = await auditLogModel
        .find({
          workspaceId,
        })
        .sort({ createdAt: -1 })
        .lean();

      expect(result.map((audit) => audit._id.toString())).toEqual(
        databaseLogs.map((audit) => audit._id.toString()),
      );
    });

    it('should accept a different userId without changing workspace filtering', async () => {
      const query = new GetWorkspaceAuditLogsQuery(
        workspaceId.toString(),
        otherUserId.toString(),
        1,
        20,
      );

      const result = await auditHandler.execute(query);

      expect(result).toHaveLength(3);

      expect(
        result.every(
          (audit) => audit.workspaceId?.toString() === workspaceId.toString(),
        ),
      ).toBe(true);
    });
  });

  describe('AuditLog immutability', () => {
    it('should reject updating an audit log', async () => {
      const audit = await auditLogModel.create({
        actorId: userId,
        action: 'TASK_CREATED',
        resource: 'TASK',
        workspaceId,
        meta: {
          taskId: 'immutable-task',
        },
      });

      await expect(
        auditLogModel.updateOne(
          { _id: audit._id },
          {
            $set: {
              action: 'TASK_UPDATED',
            },
          },
        ),
      ).rejects.toThrow('Audit logs are immutable');

      const storedAudit = await auditLogModel.findById(audit._id).lean();

      expect(storedAudit?.action).toBe('TASK_CREATED');
    });

    it('should reject deleting an audit log', async () => {
      const audit = await auditLogModel.create({
        actorId: userId,
        action: 'TASK_CREATED',
        resource: 'TASK',
        workspaceId,
      });

      await expect(
        auditLogModel.deleteOne({
          _id: audit._id,
        }),
      ).rejects.toThrow('Audit logs are immutable');

      const storedAudit = await auditLogModel.findById(audit._id).lean();

      expect(storedAudit).toBeDefined();
    });
  });
});
