import { WorkspaceSettingsEntity } from '../entities/workspace-settings.entity';

export interface WorkspaceSettingsRepository {
  findByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceSettingsEntity | null>;

  create(settings: WorkspaceSettingsEntity): Promise<WorkspaceSettingsEntity>;

  update(
    workspaceId: string,
    settings: Partial<WorkspaceSettingsEntity>,
  ): Promise<WorkspaceSettingsEntity>;
}

export const WORKSPACE_SETTINGS_REPOSITORY = 'WORKSPACE_SETTINGS_REPOSITORY';
