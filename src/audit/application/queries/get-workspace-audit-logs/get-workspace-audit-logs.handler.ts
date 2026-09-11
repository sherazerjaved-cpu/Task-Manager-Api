import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetWorkspaceAuditLogsQuery } from './get-workspace-audit-logs.query';
import type { IAuditLogRepository } from 'src/audit/domain/repositories/audit-log.repository.interface';
import { AUDIT_LOG_REPOSITORY } from 'src/audit/domain/constants/repository.tokens';

@QueryHandler(GetWorkspaceAuditLogsQuery)
export class GetWorkspaceAuditLogsHandler implements IQueryHandler<GetWorkspaceAuditLogsQuery> {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async execute(query: GetWorkspaceAuditLogsQuery) {
    return this.auditLogRepository.findByWorkspace(
      query.workspaceId,
      query.page,
      query.limit,
    );
  }
}
