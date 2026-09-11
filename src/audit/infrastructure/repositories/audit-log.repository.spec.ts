import { Types } from 'mongoose';

import { AuditLogRepository } from './audit-log.repository';

describe('AuditLogRepository', () => {
  let repository: AuditLogRepository;

  let auditLogModel: {
    create: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(() => {
    auditLogModel = {
      create: jest.fn(),
      find: jest.fn(),
    };

    repository = new AuditLogRepository(auditLogModel as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an audit log with all provided fields', async () => {
      const actorId = new Types.ObjectId().toHexString();
      const workspaceId = new Types.ObjectId().toHexString();

      const data = {
        actorId,
        action: 'TASK_CREATED',
        resource: 'task-123',
        workspaceId,
        ip: '127.0.0.1',
        meta: {
          taskId: 'task-123',
          priority: 'high',
        },
      };

      const createdAuditLog = {
        _id: new Types.ObjectId(),
        ...data,
      };

      auditLogModel.create.mockResolvedValue([createdAuditLog]);

      const result = await repository.create(data);

      expect(auditLogModel.create).toHaveBeenCalledTimes(1);

      expect(auditLogModel.create).toHaveBeenCalledWith(
        [
          {
            actorId: expect.any(Types.ObjectId),
            action: 'TASK_CREATED',
            resource: 'task-123',
            workspaceId: expect.any(Types.ObjectId),
            ip: '127.0.0.1',
            meta: {
              taskId: 'task-123',
              priority: 'high',
            },
          },
        ],
        {
          session: undefined,
        },
      );

      const createCall = auditLogModel.create.mock.calls[0][0][0];

      expect(createCall.actorId.toString()).toBe(actorId);
      expect(createCall.workspaceId.toString()).toBe(workspaceId);

      expect(result).toBe(createdAuditLog);
    });

    it('should convert actorId to a MongoDB ObjectId', async () => {
      const actorId = new Types.ObjectId().toHexString();

      const createdAuditLog = {
        _id: new Types.ObjectId(),
      };

      auditLogModel.create.mockResolvedValue([createdAuditLog]);

      await repository.create({
        actorId,
        action: 'LOGIN',
        resource: 'user-123',
      });

      const createCall = auditLogModel.create.mock.calls[0][0][0];

      expect(createCall.actorId).toBeInstanceOf(Types.ObjectId);
      expect(createCall.actorId.toString()).toBe(actorId);
    });

    it('should convert workspaceId to a MongoDB ObjectId', async () => {
      const workspaceId = new Types.ObjectId().toHexString();

      auditLogModel.create.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
        },
      ]);

      await repository.create({
        action: 'TASK_CREATED',
        resource: 'task-123',
        workspaceId,
      });

      const createCall = auditLogModel.create.mock.calls[0][0][0];

      expect(createCall.workspaceId).toBeInstanceOf(Types.ObjectId);
      expect(createCall.workspaceId.toString()).toBe(workspaceId);
    });

    it('should leave actorId undefined when it is not provided', async () => {
      auditLogModel.create.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
        },
      ]);

      await repository.create({
        action: 'SYSTEM_EVENT',
        resource: 'system',
      });

      const createCall = auditLogModel.create.mock.calls[0][0][0];

      expect(createCall.actorId).toBeUndefined();
    });

    it('should leave workspaceId undefined when it is not provided', async () => {
      auditLogModel.create.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
        },
      ]);

      await repository.create({
        action: 'SYSTEM_EVENT',
        resource: 'system',
      });

      const createCall = auditLogModel.create.mock.calls[0][0][0];

      expect(createCall.workspaceId).toBeUndefined();
    });

    it('should pass the provided MongoDB session', async () => {
      const session = {
        id: 'mock-session',
      } as any;

      auditLogModel.create.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
        },
      ]);

      await repository.create(
        {
          action: 'TASK_CREATED',
          resource: 'task-123',
        },
        session,
      );

      expect(auditLogModel.create).toHaveBeenCalledWith(
        [
          {
            actorId: undefined,
            action: 'TASK_CREATED',
            resource: 'task-123',
            workspaceId: undefined,
            ip: undefined,
            meta: undefined,
          },
        ],
        {
          session,
        },
      );
    });

    it('should return the first created audit log', async () => {
      const firstAuditLog = {
        _id: new Types.ObjectId(),
        action: 'TASK_CREATED',
      };

      const secondAuditLog = {
        _id: new Types.ObjectId(),
        action: 'TASK_UPDATED',
      };

      auditLogModel.create.mockResolvedValue([firstAuditLog, secondAuditLog]);

      const result = await repository.create({
        action: 'TASK_CREATED',
        resource: 'task-123',
      });

      expect(result).toBe(firstAuditLog);
    });

    it('should propagate errors from the model', async () => {
      auditLogModel.create.mockRejectedValue(
        new Error('MongoDB create failed'),
      );

      await expect(
        repository.create({
          action: 'TASK_CREATED',
          resource: 'task-123',
        }),
      ).rejects.toThrow('MongoDB create failed');
    });
  });

  describe('findByWorkspace', () => {
    it('should query audit logs for the specified workspace', async () => {
      const workspaceId = new Types.ObjectId().toHexString();

      const auditLogs = [
        {
          _id: new Types.ObjectId(),
          action: 'TASK_CREATED',
        },
        {
          _id: new Types.ObjectId(),
          action: 'TASK_UPDATED',
        },
      ];

      const exec = jest.fn().mockResolvedValue(auditLogs);
      const limit = jest.fn().mockReturnValue({ exec });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });

      auditLogModel.find.mockReturnValue({
        sort,
      });

      const result = await repository.findByWorkspace(workspaceId, 1, 20);

      expect(auditLogModel.find).toHaveBeenCalledTimes(1);

      expect(auditLogModel.find).toHaveBeenCalledWith({
        workspaceId: expect.any(Types.ObjectId),
      });

      const findFilter = auditLogModel.find.mock.calls[0][0];

      expect(findFilter.workspaceId.toString()).toBe(workspaceId);

      expect(sort).toHaveBeenCalledWith({
        createdAt: -1,
      });

      expect(skip).toHaveBeenCalledWith(0);
      expect(limit).toHaveBeenCalledWith(20);
      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toBe(auditLogs);
    });

    it('should calculate skip correctly for later pages', async () => {
      const workspaceId = new Types.ObjectId().toHexString();

      const exec = jest.fn().mockResolvedValue([]);
      const limit = jest.fn().mockReturnValue({ exec });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });

      auditLogModel.find.mockReturnValue({
        sort,
      });

      await repository.findByWorkspace(workspaceId, 3, 20);

      expect(skip).toHaveBeenCalledWith(40);
      expect(limit).toHaveBeenCalledWith(20);
    });

    it('should calculate skip correctly with a different limit', async () => {
      const workspaceId = new Types.ObjectId().toHexString();

      const exec = jest.fn().mockResolvedValue([]);

      const limit = jest.fn().mockReturnValue({ exec });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });

      auditLogModel.find.mockReturnValue({
        sort,
      });

      await repository.findByWorkspace(workspaceId, 4, 25);

      expect(skip).toHaveBeenCalledWith(75);
      expect(limit).toHaveBeenCalledWith(25);
    });

    it('should sort audit logs by newest first', async () => {
      const workspaceId = new Types.ObjectId().toHexString();

      const exec = jest.fn().mockResolvedValue([]);
      const limit = jest.fn().mockReturnValue({ exec });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });

      auditLogModel.find.mockReturnValue({
        sort,
      });

      await repository.findByWorkspace(workspaceId, 1, 10);

      expect(sort).toHaveBeenCalledWith({
        createdAt: -1,
      });
    });

    it('should return an empty array when no audit logs exist', async () => {
      const workspaceId = new Types.ObjectId().toHexString();

      const exec = jest.fn().mockResolvedValue([]);
      const limit = jest.fn().mockReturnValue({ exec });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });

      auditLogModel.find.mockReturnValue({
        sort,
      });

      const result = await repository.findByWorkspace(workspaceId, 1, 20);

      expect(result).toEqual([]);
    });

    it('should propagate errors from the query', async () => {
      const workspaceId = new Types.ObjectId().toHexString();

      const exec = jest
        .fn()
        .mockRejectedValue(new Error('MongoDB query failed'));

      const limit = jest.fn().mockReturnValue({ exec });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });

      auditLogModel.find.mockReturnValue({
        sort,
      });

      await expect(
        repository.findByWorkspace(workspaceId, 1, 20),
      ).rejects.toThrow('MongoDB query failed');
    });
  });
});
