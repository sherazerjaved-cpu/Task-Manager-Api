import {
  WorkspaceSettingsEntity,
  WorkspaceSettingsProps,
} from './workspace-settings.entity';
import { TaskPriority } from '../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../task/Enums/task-status.enum';

describe('WorkspaceSettingsEntity', () => {
  const props: WorkspaceSettingsProps = {
    workspaceId: 'workspace-123',
    timezone: 'Asia/Karachi',
    defaultTaskPriority: TaskPriority.Medium,
    defaultTaskStatus: TaskStatus.Pending,
    emailNotifications: true,
    taskAssignmentNotifications: true,
  };

  describe('constructor', () => {
    it('should create a workspace settings entity with the provided values', () => {
      const entity = new WorkspaceSettingsEntity(
        props.workspaceId,
        props.timezone,
        props.defaultTaskPriority,
        props.defaultTaskStatus,
        props.emailNotifications,
        props.taskAssignmentNotifications,
      );

      expect(entity).toBeInstanceOf(WorkspaceSettingsEntity);

      expect(entity.workspaceId).toBe(props.workspaceId);
      expect(entity.timezone).toBe(props.timezone);
      expect(entity.defaultTaskPriority).toBe(props.defaultTaskPriority);
      expect(entity.defaultTaskStatus).toBe(props.defaultTaskStatus);
      expect(entity.emailNotifications).toBe(props.emailNotifications);
      expect(entity.taskAssignmentNotifications).toBe(
        props.taskAssignmentNotifications,
      );
    });

    it('should preserve false boolean values', () => {
      const entity = new WorkspaceSettingsEntity(
        props.workspaceId,
        props.timezone,
        props.defaultTaskPriority,
        props.defaultTaskStatus,
        false,
        false,
      );

      expect(entity.emailNotifications).toBe(false);
      expect(entity.taskAssignmentNotifications).toBe(false);
    });
  });

  describe('create', () => {
    it('should create an entity from WorkspaceSettingsProps', () => {
      const entity = WorkspaceSettingsEntity.create(props);

      expect(entity).toBeInstanceOf(WorkspaceSettingsEntity);

      expect(entity.workspaceId).toBe(props.workspaceId);
      expect(entity.timezone).toBe(props.timezone);
      expect(entity.defaultTaskPriority).toBe(props.defaultTaskPriority);
      expect(entity.defaultTaskStatus).toBe(props.defaultTaskStatus);
      expect(entity.emailNotifications).toBe(props.emailNotifications);
      expect(entity.taskAssignmentNotifications).toBe(
        props.taskAssignmentNotifications,
      );
    });

    it('should map every property from props correctly', () => {
      const customProps: WorkspaceSettingsProps = {
        workspaceId: 'workspace-456',
        timezone: 'UTC',
        defaultTaskPriority: TaskPriority.High,
        defaultTaskStatus: TaskStatus.Done,
        emailNotifications: false,
        taskAssignmentNotifications: false,
      };

      const entity = WorkspaceSettingsEntity.create(customProps);

      expect(entity).toEqual(
        new WorkspaceSettingsEntity(
          'workspace-456',
          'UTC',
          TaskPriority.High,
          TaskStatus.Done,
          false,
          false,
        ),
      );
    });

    it('should return a new entity instance', () => {
      const entity = WorkspaceSettingsEntity.create(props);

      expect(entity).not.toBe(props);
      expect(entity).toBeInstanceOf(WorkspaceSettingsEntity);
    });
  });
});
