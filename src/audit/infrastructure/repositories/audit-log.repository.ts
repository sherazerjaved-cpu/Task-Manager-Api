import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { ClientSession } from 'mongoose';

import { AuditLog, AuditLogDocument } from 'src/audit/schema/audit-log.schema';

import { IAuditLogRepository } from 'src/audit/domain/repositories/audit-log.repository.interface';

@Injectable()
export class AuditLogRepository implements IAuditLogRepository {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async create(
    data: {
      actorId?: string;
      action: string;
      resource: string;
      workspaceId?: string;
      ip?: string;
      meta?: Record<string, unknown>;
    },
    session?: ClientSession,
  ): Promise<AuditLogDocument> {
    const [auditLog] = await this.auditLogModel.create(
      [
        {
          actorId: data.actorId ? new Types.ObjectId(data.actorId) : undefined,

          action: data.action,

          resource: data.resource,

          workspaceId: data.workspaceId
            ? new Types.ObjectId(data.workspaceId)
            : undefined,

          ip: data.ip,

          meta: data.meta,
        },
      ],
      { session },
    );

    return auditLog;
  }

  async findByWorkspace(
    workspaceId: string,
    page: number,
    limit: number,
  ): Promise<AuditLogDocument[]> {
    const skip = (page - 1) * limit;

    return this.auditLogModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }
}
