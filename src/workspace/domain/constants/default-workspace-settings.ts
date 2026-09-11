import { TaskPriority } from '../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../task/Enums/task-status.enum';

export const DEFAULT_WORKSPACE_SETTINGS = {
  timezone: 'UTC',
  defaultTaskPriority: TaskPriority.Medium,
  defaultTaskStatus: TaskStatus.Pending,
  emailNotifications: true,
  taskAssignmentNotifications: true,
};
