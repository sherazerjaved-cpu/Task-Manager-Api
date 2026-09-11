import { TaskPriority } from '../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../task/Enums/task-status.enum';

export interface WorkspaceSettingsProps {
  workspaceId: string;
  timezone: string;
  defaultTaskPriority: TaskPriority;
  defaultTaskStatus: TaskStatus;
  emailNotifications: boolean;
  taskAssignmentNotifications: boolean;
}

export class WorkspaceSettingsEntity {
  constructor(
    public readonly workspaceId: string,
    public timezone: string,
    public defaultTaskPriority: TaskPriority,
    public defaultTaskStatus: TaskStatus,
    public emailNotifications: boolean,
    public taskAssignmentNotifications: boolean,
  ) {}

  static create(props: WorkspaceSettingsProps): WorkspaceSettingsEntity {
    return new WorkspaceSettingsEntity(
      props.workspaceId,
      props.timezone,
      props.defaultTaskPriority,
      props.defaultTaskStatus,
      props.emailNotifications,
      props.taskAssignmentNotifications,
    );
  }
}
