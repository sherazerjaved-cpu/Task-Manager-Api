import { GetWorkspaceAuditLogsHandler } from './get-workspace-audit-logs.handler';
import { GetWorkspaceAuditLogsQuery } from './get-workspace-audit-logs.query';
import type { IAuditLogRepository } from 'src/audit/domain/repositories/audit-log.repository.interface';

describe('GetWorkspaceAuditLogsHandler', () => {
  let handler: GetWorkspaceAuditLogsHandler;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;

  beforeEach(() => {
    auditLogRepository = {
      create: jest.fn(),
      findByWorkspace: jest.fn(),
    };

    handler = new GetWorkspaceAuditLogsHandler(auditLogRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should fetch audit logs for the requested workspace', async () => {
      const query = new GetWorkspaceAuditLogsQuery(
        'workspace-123',
        'user-123',
        1,
        20,
      );

      const auditLogs = [
        {
          _id: 'audit-1',
          action: 'TASK_CREATED',
          resource: 'task-123',
        },
        {
          _id: 'audit-2',
          action: 'TASK_UPDATED',
          resource: 'task-456',
        },
      ];

      auditLogRepository.findByWorkspace.mockResolvedValue(auditLogs as any);

      const result = await handler.execute(query);

      expect(auditLogRepository.findByWorkspace.mock.calls).toHaveLength(1);

      expect(auditLogRepository.findByWorkspace.mock.calls[0]).toEqual([
        'workspace-123',
        1,
        20,
      ]);

      expect(result).toBe(auditLogs);
    });

    it('should pass the requested page and limit to the repository', async () => {
      const query = new GetWorkspaceAuditLogsQuery(
        'workspace-456',
        'user-456',
        3,
        50,
      );

      const auditLogs = [
        {
          _id: 'audit-1',
          action: 'LOGIN',
          resource: 'user-123',
        },
      ];

      auditLogRepository.findByWorkspace.mockResolvedValue(auditLogs as any);

      await handler.execute(query);

      expect(auditLogRepository.findByWorkspace.mock.calls[0]).toEqual([
        'workspace-456',
        3,
        50,
      ]);
    });

    it('should not use userId when querying the repository', async () => {
      const query = new GetWorkspaceAuditLogsQuery(
        'workspace-123',
        'user-999',
        2,
        10,
      );

      auditLogRepository.findByWorkspace.mockResolvedValue([]);

      await handler.execute(query);

      expect(auditLogRepository.findByWorkspace.mock.calls[0]).toEqual([
        'workspace-123',
        2,
        10,
      ]);

      expect(auditLogRepository.findByWorkspace.mock.calls).not.toContainEqual([
        'workspace-123',
        'user-999',
        2,
        10,
      ]);
    });

    it('should return an empty array when the repository returns no logs', async () => {
      const query = new GetWorkspaceAuditLogsQuery(
        'workspace-123',
        'user-123',
        1,
        20,
      );

      auditLogRepository.findByWorkspace.mockResolvedValue([]);

      const result = await handler.execute(query);

      expect(result).toEqual([]);

      expect(auditLogRepository.findByWorkspace.mock.calls[0]).toEqual([
        'workspace-123',
        1,
        20,
      ]);
    });

    it('should propagate repository errors', async () => {
      const query = new GetWorkspaceAuditLogsQuery(
        'workspace-123',
        'user-123',
        1,
        20,
      );

      auditLogRepository.findByWorkspace.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(handler.execute(query)).rejects.toThrow('Database error');

      expect(auditLogRepository.findByWorkspace.mock.calls).toHaveLength(1);
    });
  });
});
