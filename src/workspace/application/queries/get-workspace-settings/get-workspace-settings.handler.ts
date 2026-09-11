import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetWorkspaceSettingsQuery } from './get-workspace-settings.query';
import { WorkspaceSettingsService } from '../../services/workspace-settings.service';

@QueryHandler(GetWorkspaceSettingsQuery)
export class GetWorkspaceSettingsHandler implements IQueryHandler<GetWorkspaceSettingsQuery> {
  constructor(
    private readonly workspaceSettingsService: WorkspaceSettingsService,
  ) {}

  async execute(query: GetWorkspaceSettingsQuery) {
    return this.workspaceSettingsService.getSettings(query.workspaceId);
  }
}
