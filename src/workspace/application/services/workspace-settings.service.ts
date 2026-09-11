import { Inject, Injectable } from '@nestjs/common';

import { WorkspaceSettingsEntity } from '../../domain/entities/workspace-settings.entity';
import { DEFAULT_WORKSPACE_SETTINGS } from '../../domain/constants/default-workspace-settings';

import type { WorkspaceSettingsRepository } from '../../domain/repositories/workspace-settings.repository.interface';

import { WORKSPACE_SETTINGS_REPOSITORY } from '../../domain/repositories/workspace-settings.repository.interface';
import { TaskPriority } from '../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../task/Enums/task-status.enum';

@Injectable()
export class WorkspaceSettingsService {
  constructor(
    @Inject(WORKSPACE_SETTINGS_REPOSITORY)
    private readonly settingsRepository: WorkspaceSettingsRepository,
  ) {}

  async getSettings(workspaceId: string): Promise<WorkspaceSettingsEntity> {
    const existing =
      await this.settingsRepository.findByWorkspaceId(workspaceId);

    if (existing) {
      return existing;
    }

    return this.settingsRepository.create(
      new WorkspaceSettingsEntity(
        workspaceId,
        DEFAULT_WORKSPACE_SETTINGS.timezone,
        DEFAULT_WORKSPACE_SETTINGS.defaultTaskPriority,
        DEFAULT_WORKSPACE_SETTINGS.defaultTaskStatus,
        DEFAULT_WORKSPACE_SETTINGS.emailNotifications,
        DEFAULT_WORKSPACE_SETTINGS.taskAssignmentNotifications,
      ),
    );
  }

  async createDefaultSettings(
    workspaceId: string,
  ): Promise<WorkspaceSettingsEntity> {
    const existing =
      await this.settingsRepository.findByWorkspaceId(workspaceId);

    if (existing) {
      return existing;
    }

    return this.settingsRepository.create(
      new WorkspaceSettingsEntity(
        workspaceId,
        DEFAULT_WORKSPACE_SETTINGS.timezone,
        DEFAULT_WORKSPACE_SETTINGS.defaultTaskPriority,
        DEFAULT_WORKSPACE_SETTINGS.defaultTaskStatus,
        DEFAULT_WORKSPACE_SETTINGS.emailNotifications,
        DEFAULT_WORKSPACE_SETTINGS.taskAssignmentNotifications,
      ),
    );
  }

  async updateSettings(
    workspaceId: string,
    settings: Partial<{
      timezone: string;
      defaultTaskPriority: TaskPriority;
      defaultTaskStatus: TaskStatus;
      emailNotifications: boolean;
      taskAssignmentNotifications: boolean;
    }>,
  ): Promise<WorkspaceSettingsEntity> {
    const existing =
      await this.settingsRepository.findByWorkspaceId(workspaceId);

    if (!existing) {
      return this.settingsRepository.create(
        new WorkspaceSettingsEntity(
          workspaceId,
          settings.timezone ?? DEFAULT_WORKSPACE_SETTINGS.timezone,
          settings.defaultTaskPriority ??
            DEFAULT_WORKSPACE_SETTINGS.defaultTaskPriority,
          settings.defaultTaskStatus ??
            DEFAULT_WORKSPACE_SETTINGS.defaultTaskStatus,
          settings.emailNotifications ??
            DEFAULT_WORKSPACE_SETTINGS.emailNotifications,
          settings.taskAssignmentNotifications ??
            DEFAULT_WORKSPACE_SETTINGS.taskAssignmentNotifications,
        ),
      );
    }

    return this.settingsRepository.update(workspaceId, settings);
  }
}
