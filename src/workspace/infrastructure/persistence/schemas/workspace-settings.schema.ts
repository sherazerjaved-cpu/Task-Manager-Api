import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { TaskPriority } from '../../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../../task/Enums/task-status.enum';

@Schema({
  collection: 'workspacesettings',
  timestamps: true,
})
export class WorkspaceSettings {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  workspaceId!: string;

  @Prop({
    required: true,
    default: 'UTC',
  })
  timezone!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(TaskPriority),
    default: TaskPriority.Medium,
  })
  defaultTaskPriority!: TaskPriority;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(TaskStatus),
    default: TaskStatus.Pending,
  })
  defaultTaskStatus!: TaskStatus;

  @Prop({
    required: true,
    default: true,
  })
  emailNotifications!: boolean;

  @Prop({
    required: true,
    default: true,
  })
  taskAssignmentNotifications!: boolean;
}

export type WorkspaceSettingsDocument = HydratedDocument<WorkspaceSettings>;

export const WorkspaceSettingsSchema =
  SchemaFactory.createForClass(WorkspaceSettings);
