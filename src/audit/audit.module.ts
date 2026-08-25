import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { AuditLog, AuditLogSchema } from './schema/audit-log.schema';
import { AuditLogRepository } from './infrastructure/repositories/audit-log.repository';
import { AUDIT_LOG_REPOSITORY } from './domain/constants/repository.tokens';
import { AuditService } from './application/audit.service';
import { GetWorkspaceAuditLogsHandler } from './application/queries/get-workspace-audit-logs/get-workspace-audit-logs.handler';

@Module({
  imports: [
    CqrsModule,

    MongooseModule.forFeature([
      {
        name: AuditLog.name,
        schema: AuditLogSchema,
      },
    ]),
  ],

  providers: [
    AuditService,

    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: AuditLogRepository,
    },
    GetWorkspaceAuditLogsHandler,
  ],

  exports: [AuditService, AUDIT_LOG_REPOSITORY],
})
export class AuditModule {}
