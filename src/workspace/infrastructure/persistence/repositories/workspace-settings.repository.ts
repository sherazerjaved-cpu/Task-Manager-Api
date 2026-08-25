import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  WorkspaceSettings,
  WorkspaceSettingsDocument,
} from '../schemas/workspace-settings.schema';

import { WorkspaceSettingsEntity } from '../../../domain/entities/workspace-settings.entity';
import type { WorkspaceSettingsRepository as IWorkspaceSettingsRepository } from '../../../domain/repositories/workspace-settings.repository.interface';

@Injectable()
export class WorkspaceSettingsRepository implements IWorkspaceSettingsRepository {
  constructor(
    @InjectModel(WorkspaceSettings.name)
    private readonly model: Model<WorkspaceSettingsDocument>,
  ) {}

  async findByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceSettingsEntity | null> {
    const document = await this.model.findOne({ workspaceId }).lean().exec();

    if (!document) {
      return null;
    }

    return this.toEntity(document);
  }

  async create(
    settings: WorkspaceSettingsEntity,
  ): Promise<WorkspaceSettingsEntity> {
    const document = await this.model.create({
      workspaceId: settings.workspaceId,
      timezone: settings.timezone,
      defaultTaskPriority: settings.defaultTaskPriority,
      defaultTaskStatus: settings.defaultTaskStatus,
      emailNotifications: settings.emailNotifications,
      taskAssignmentNotifications: settings.taskAssignmentNotifications,
    });

    return this.toEntity(document);
  }

  async update(
    workspaceId: string,
    settings: Partial<WorkspaceSettingsEntity>,
  ): Promise<WorkspaceSettingsEntity> {
    const document = await this.model
      .findOneAndUpdate(
        { workspaceId },
        {
          $set: settings,
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!document) {
      throw new Error(
        `Workspace settings not found for workspace ${workspaceId}`,
      );
    }

    return this.toEntity(document);
  }

  private toEntity(
    document: WorkspaceSettingsDocument | Record<string, any>,
  ): WorkspaceSettingsEntity {
    return WorkspaceSettingsEntity.create({
      workspaceId: document.workspaceId,
      timezone: document.timezone,
      defaultTaskPriority: document.defaultTaskPriority,
      defaultTaskStatus: document.defaultTaskStatus,
      emailNotifications: document.emailNotifications,
      taskAssignmentNotifications: document.taskAssignmentNotifications,
    });
  }
}
