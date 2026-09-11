import { Inject, Injectable } from '@nestjs/common';
import type { IAuditLogRepository } from '../domain/repositories/audit-log.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '../domain/constants/repository.tokens';
import type { ClientSession } from 'mongoose';

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async log(
    data: {
      actorId?: string;
      action: string;
      resource: string;
      workspaceId?: string;
      ip?: string;
      meta?: Record<string, unknown>;
    },
    session?: ClientSession,
  ): Promise<void> {
    const sanitizedMeta = this.sanitizeMeta(data.meta);

    await this.auditLogRepository.create(
      {
        actorId: data.actorId,
        action: data.action,
        resource: data.resource,
        workspaceId: data.workspaceId,
        ip: data.ip,
        meta: sanitizedMeta,
      },
      session,
    );
  }

  private sanitizeMeta(
    meta?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!meta) {
      return undefined;
    }

    const sensitiveKeys = new Set([
      'password',
      'passwordhash',
      'accesstoken',
      'access_token',
      'refreshtoken',
      'refresh_token',
      'token',
      'tokenhash',
      'secret',
      'clientsecret',
      'apikey',
      'authorization',
      'cookie',
      'verificationtoken',
      'verification_token',
      'resettoken',
      'reset_token',
      'passwordresettoken',
      'password_reset_token',
    ]);

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(meta)) {
      const normalizedKey = key.replace(/-/g, '').toLowerCase();

      if (sensitiveKeys.has(normalizedKey)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }
}
