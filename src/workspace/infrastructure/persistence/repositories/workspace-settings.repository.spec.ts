import { WorkspaceSettingsRepository } from './workspace-settings.repository';
import { WorkspaceSettingsEntity } from '../../../domain/entities/workspace-settings.entity';
import { TaskPriority } from '../../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../../task/Enums/task-status.enum';

describe('WorkspaceSettingsRepository', () => {
  let repository: WorkspaceSettingsRepository;

  const workspaceId = '68a123456789abcdef123456';

  const settings = new WorkspaceSettingsEntity(
    workspaceId,
    'Asia/Karachi',
    TaskPriority.Medium,
    TaskStatus.Pending,
    true,
    true,
  );

  const document = {
    workspaceId,
    timezone: 'Asia/Karachi',
    defaultTaskPriority: TaskPriority.Medium,
    defaultTaskStatus: TaskStatus.Pending,
    emailNotifications: true,
    taskAssignmentNotifications: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const model = {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    repository = new WorkspaceSettingsRepository(model);
  });

  describe('findByWorkspaceId', () => {
    it('should return workspace settings when found', async () => {
      model.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(document),
        }),
      });

      const result = await repository.findByWorkspaceId(workspaceId);

      expect(model.findOne).toHaveBeenCalledWith({
        workspaceId,
      });

      expect(result).toBeInstanceOf(WorkspaceSettingsEntity);
      expect(result).toEqual(
        expect.objectContaining({
          workspaceId,
          timezone: 'Asia/Karachi',
          defaultTaskPriority: TaskPriority.Medium,
          defaultTaskStatus: TaskStatus.Pending,
          emailNotifications: true,
          taskAssignmentNotifications: true,
        }),
      );
    });

    it('should return null when workspace settings do not exist', async () => {
      model.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await repository.findByWorkspaceId(workspaceId);

      expect(result).toBeNull();
    });

    it('should propagate errors from model.findOne', async () => {
      const error = new Error('Database error');

      model.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(error),
        }),
      });

      await expect(repository.findByWorkspaceId(workspaceId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('create', () => {
    it('should create workspace settings with the correct arguments', async () => {
      model.create.mockResolvedValue(document);

      const result = await repository.create(settings);

      expect(model.create).toHaveBeenCalledWith({
        workspaceId: settings.workspaceId,
        timezone: settings.timezone,
        defaultTaskPriority: settings.defaultTaskPriority,
        defaultTaskStatus: settings.defaultTaskStatus,
        emailNotifications: settings.emailNotifications,
        taskAssignmentNotifications: settings.taskAssignmentNotifications,
      });

      expect(result).toBeInstanceOf(WorkspaceSettingsEntity);
      expect(result).toEqual(
        expect.objectContaining({
          workspaceId,
          timezone: 'Asia/Karachi',
          defaultTaskPriority: TaskPriority.Medium,
          defaultTaskStatus: TaskStatus.Pending,
          emailNotifications: true,
          taskAssignmentNotifications: true,
        }),
      );
    });

    it('should propagate errors from model.create', async () => {
      const error = new Error('Database error');

      model.create.mockRejectedValue(error);

      await expect(repository.create(settings)).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('should update workspace settings with the correct arguments', async () => {
      const updateSettings = {
        timezone: 'UTC',
        emailNotifications: false,
      };

      const updatedDocument = {
        ...document,
        ...updateSettings,
      };

      model.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedDocument),
      });

      const result = await repository.update(workspaceId, updateSettings);

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { workspaceId },
        {
          $set: updateSettings,
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(result).toBeInstanceOf(WorkspaceSettingsEntity);
      expect(result).toEqual(
        expect.objectContaining({
          workspaceId,
          timezone: 'UTC',
          emailNotifications: false,
        }),
      );
    });

    it('should update all supported settings', async () => {
      const updateSettings = {
        timezone: 'Europe/London',
        defaultTaskPriority: TaskPriority.High,
        defaultTaskStatus: TaskStatus.Done,
        emailNotifications: false,
        taskAssignmentNotifications: false,
      };

      const updatedDocument = {
        ...document,
        ...updateSettings,
      };

      model.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedDocument),
      });

      const result = await repository.update(workspaceId, updateSettings);

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { workspaceId },
        {
          $set: updateSettings,
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(result).toEqual(
        expect.objectContaining({
          workspaceId,
          timezone: 'Europe/London',
          defaultTaskPriority: TaskPriority.High,
          defaultTaskStatus: TaskStatus.Done,
          emailNotifications: false,
          taskAssignmentNotifications: false,
        }),
      );
    });

    it('should throw an error when workspace settings do not exist', async () => {
      model.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        repository.update(workspaceId, {
          timezone: 'UTC',
        }),
      ).rejects.toThrow(
        `Workspace settings not found for workspace ${workspaceId}`,
      );
    });

    it('should propagate errors from model.findOneAndUpdate', async () => {
      const error = new Error('Database error');

      model.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(
        repository.update(workspaceId, {
          timezone: 'UTC',
        }),
      ).rejects.toThrow(error);
    });
  });
});
