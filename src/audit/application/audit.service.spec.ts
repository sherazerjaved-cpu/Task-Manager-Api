import { AuditService } from './audit.service';
import type { IAuditLogRepository } from '../domain/repositories/audit-log.repository.interface';
import type { ClientSession } from 'mongoose';

describe('AuditService', () => {
  let service: AuditService;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;

  beforeEach(() => {
    auditLogRepository = {
      create: jest.fn(),
      findByWorkspace: jest.fn(),
    };

    service = new AuditService(auditLogRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create an audit log with the provided data', async () => {
      const data = {
        actorId: 'actor-123',
        action: 'TASK_CREATED',
        resource: 'task-123',
        workspaceId: 'workspace-123',
        ip: '127.0.0.1',
        meta: {
          taskTitle: 'Test task',
          priority: 'high',
        },
      };

      await service.log(data);

      expect(auditLogRepository.create.mock.calls).toHaveLength(1);
      expect(auditLogRepository.create.mock.calls[0]).toEqual([
        {
          actorId: 'actor-123',
          action: 'TASK_CREATED',
          resource: 'task-123',
          workspaceId: 'workspace-123',
          ip: '127.0.0.1',
          meta: {
            taskTitle: 'Test task',
            priority: 'high',
          },
        },
        undefined,
      ]);
    });

    it('should pass the MongoDB session to the repository', async () => {
      const session = {} as ClientSession;

      const data = {
        actorId: 'actor-123',
        action: 'TASK_UPDATED',
        resource: 'task-123',
        workspaceId: 'workspace-123',
      };

      await service.log(data, session);

      expect(auditLogRepository.create.mock.calls[0]).toEqual([
        {
          actorId: 'actor-123',
          action: 'TASK_UPDATED',
          resource: 'task-123',
          workspaceId: 'workspace-123',
          ip: undefined,
          meta: undefined,
        },
        session,
      ]);
    });

    it('should preserve safe metadata', async () => {
      const meta = {
        taskId: 'task-123',
        status: 'completed',
        priority: 'high',
        attempt: 2,
        successful: true,
      };

      await service.log({
        action: 'TASK_UPDATED',
        resource: 'task-123',
        meta,
      });

      expect(auditLogRepository.create.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          meta,
        }),
      );
    });

    it('should redact sensitive metadata keys', async () => {
      const meta = {
        password: 'super-secret',
        passwordhash: 'hashed-password',
        accesstoken: 'access-token',
        access_token: 'access-token',
        refreshtoken: 'refresh-token',
        refresh_token: 'refresh-token',
        token: 'token-value',
        tokenhash: 'token-hash',
        secret: 'secret-value',
        clientsecret: 'client-secret',
        apikey: 'api-key',
        authorization: 'Bearer token',
        cookie: 'session-cookie',
        verificationtoken: 'verification-token',
        verification_token: 'verification-token',
        resettoken: 'reset-token',
        reset_token: 'reset-token',
        passwordresettoken: 'password-reset-token',
        password_reset_token: 'password-reset-token',
      };

      await service.log({
        action: 'USER_UPDATED',
        resource: 'user-123',
        meta,
      });

      const expectedMeta = Object.fromEntries(
        Object.keys(meta).map((key) => [key, '[REDACTED]']),
      );

      expect(auditLogRepository.create.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          meta: expectedMeta,
        }),
      );
    });

    it('should redact sensitive keys case-insensitively', async () => {
      const meta = {
        PASSWORD: 'secret',
        Password: 'secret',
        ACCESS_TOKEN: 'access-token',
        RefreshToken: 'refresh-token',
        APIKEY: 'api-key',
        Authorization: 'Bearer token',
      };

      await service.log({
        action: 'LOGIN',
        resource: 'user-123',
        meta,
      });

      expect(auditLogRepository.create.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          meta: {
            PASSWORD: '[REDACTED]',
            Password: '[REDACTED]',
            ACCESS_TOKEN: '[REDACTED]',
            RefreshToken: '[REDACTED]',
            APIKEY: '[REDACTED]',
            Authorization: '[REDACTED]',
          },
        }),
      );
    });

    it('should redact hyphenated sensitive keys', async () => {
      const meta = {
        'access-token': 'access-token',
        'refresh-token': 'refresh-token',
        'client-secret': 'client-secret',
      };

      await service.log({
        action: 'AUTH_EVENT',
        resource: 'user-123',
        meta,
      });

      expect(auditLogRepository.create.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          meta: {
            'access-token': '[REDACTED]',
            'refresh-token': '[REDACTED]',
            'client-secret': '[REDACTED]',
          },
        }),
      );
    });

    it('should preserve non-sensitive metadata while redacting sensitive metadata', async () => {
      const meta = {
        username: 'john',
        role: 'member',
        password: 'secret',
        taskId: 'task-123',
      };

      await service.log({
        action: 'USER_UPDATED',
        resource: 'user-123',
        meta,
      });

      expect(auditLogRepository.create.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          meta: {
            username: 'john',
            role: 'member',
            password: '[REDACTED]',
            taskId: 'task-123',
          },
        }),
      );
    });

    it('should leave metadata undefined when no metadata is provided', async () => {
      await service.log({
        actorId: 'actor-123',
        action: 'LOGIN',
        resource: 'user-123',
      });

      expect(auditLogRepository.create.mock.calls[0]).toEqual([
        {
          actorId: 'actor-123',
          action: 'LOGIN',
          resource: 'user-123',
          workspaceId: undefined,
          ip: undefined,
          meta: undefined,
        },
        undefined,
      ]);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Failed to create audit log');

      auditLogRepository.create.mockRejectedValue(error);

      await expect(
        service.log({
          action: 'TASK_CREATED',
          resource: 'task-123',
        }),
      ).rejects.toThrow('Failed to create audit log');

      expect(auditLogRepository.create.mock.calls).toHaveLength(1);
    });

    it('should not mutate the original metadata object', async () => {
      const meta = {
        username: 'john',
        password: 'secret',
      };

      const originalMeta = { ...meta };

      await service.log({
        action: 'USER_UPDATED',
        resource: 'user-123',
        meta,
      });

      expect(meta).toEqual(originalMeta);
    });
  });
});
