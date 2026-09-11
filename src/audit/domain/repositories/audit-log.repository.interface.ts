import { AuditLogDocument } from 'src/audit/schema/audit-log.schema';
import type { ClientSession } from 'mongoose';

export interface IAuditLogRepository {
  create(
    data: {
      actorId?: string;
      action: string;
      resource: string;
      workspaceId?: string;
      ip?: string;
      meta?: Record<string, unknown>;
    },
    session?: ClientSession,
  ): Promise<AuditLogDocument>;

  findByWorkspace(
    workspaceId: string,
    page: number,
    limit: number,
  ): Promise<AuditLogDocument[]>;
}
