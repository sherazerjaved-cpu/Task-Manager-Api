import { WorkspaceSettingsService } from './workspace-settings.service';
import { WorkspaceSettingsEntity } from '../../domain/entities/workspace-settings.entity';
import { DEFAULT_WORKSPACE_SETTINGS } from '../../domain/constants/default-workspace-settings';
import { TaskPriority } from '../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../task/Enums/task-status.enum';

describe('WorkspaceSettingsService', () => {
  let service: WorkspaceSettingsService;

  const workspaceId = 'workspace-123';

  const existingSettings = new WorkspaceSettingsEntity(
    workspaceId,
    'Asia/Karachi',
    TaskPriority.Medium,
    TaskStatus.Pending,
    true,
    true,
  );

  const createdSettings = new WorkspaceSettingsEntity(
    workspaceId,
    'Asia/Karachi',
    TaskPriority.Medium,
    TaskStatus.Pending,
    true,
    true,
  );

  const settingsRepository = {
    findByWorkspaceId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new WorkspaceSettingsService(settingsRepository as any);
  });

  describe('should be defined', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getSettings', () => {
    it('should return existing settings when they exist', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(existingSettings);

      const result = await service.getSettings(workspaceId);

      expect(settingsRepository.findByWorkspaceId).toHaveBeenCalledWith(
        workspaceId,
      );

      expect(settingsRepository.create).not.toHaveBeenCalled();

      expect(result).toBe(existingSettings);
    });

    it('should create and return default settings when settings do not exist', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(null);
      settingsRepository.create.mockResolvedValue(createdSettings);

      const result = await service.getSettings(workspaceId);

      expect(settingsRepository.findByWorkspaceId).toHaveBeenCalledWith(
        workspaceId,
      );

      expect(settingsRepository.create).toHaveBeenCalledTimes(1);

      const entity = settingsRepository.create.mock.calls[0][0];

      expect(entity).toBeInstanceOf(WorkspaceSettingsEntity);

      expect(entity).toEqual(
        expect.objectContaining({
          workspaceId,
          timezone: DEFAULT_WORKSPACE_SETTINGS.timezone,
          defaultTaskPriority: DEFAULT_WORKSPACE_SETTINGS.defaultTaskPriority,
          defaultTaskStatus: DEFAULT_WORKSPACE_SETTINGS.defaultTaskStatus,
          emailNotifications: DEFAULT_WORKSPACE_SETTINGS.emailNotifications,
          taskAssignmentNotifications:
            DEFAULT_WORKSPACE_SETTINGS.taskAssignmentNotifications,
        }),
      );

      expect(result).toBe(createdSettings);
    });

    it('should propagate errors from findByWorkspaceId', async () => {
      const error = new Error('database error');

      settingsRepository.findByWorkspaceId.mockRejectedValue(error);

      await expect(service.getSettings(workspaceId)).rejects.toThrow(error);
    });

    it('should propagate errors from create', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(null);

      const error = new Error('create failed');

      settingsRepository.create.mockRejectedValue(error);

      await expect(service.getSettings(workspaceId)).rejects.toThrow(error);
    });
  });

  describe('createDefaultSettings', () => {
    it('should return existing settings when they already exist', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(existingSettings);

      const result = await service.createDefaultSettings(workspaceId);

      expect(settingsRepository.findByWorkspaceId).toHaveBeenCalledWith(
        workspaceId,
      );

      expect(settingsRepository.create).not.toHaveBeenCalled();

      expect(result).toBe(existingSettings);
    });

    it('should create default settings when they do not exist', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(null);
      settingsRepository.create.mockResolvedValue(createdSettings);

      const result = await service.createDefaultSettings(workspaceId);

      expect(settingsRepository.findByWorkspaceId).toHaveBeenCalledWith(
        workspaceId,
      );

      expect(settingsRepository.create).toHaveBeenCalledTimes(1);

      const entity = settingsRepository.create.mock.calls[0][0];

      expect(entity).toBeInstanceOf(WorkspaceSettingsEntity);

      expect(entity).toEqual(
        expect.objectContaining({
          workspaceId,
          timezone: DEFAULT_WORKSPACE_SETTINGS.timezone,
          defaultTaskPriority: DEFAULT_WORKSPACE_SETTINGS.defaultTaskPriority,
          defaultTaskStatus: DEFAULT_WORKSPACE_SETTINGS.defaultTaskStatus,
          emailNotifications: DEFAULT_WORKSPACE_SETTINGS.emailNotifications,
          taskAssignmentNotifications:
            DEFAULT_WORKSPACE_SETTINGS.taskAssignmentNotifications,
        }),
      );

      expect(result).toBe(createdSettings);
    });

    it('should propagate errors from findByWorkspaceId', async () => {
      const error = new Error('database error');

      settingsRepository.findByWorkspaceId.mockRejectedValue(error);

      await expect(service.createDefaultSettings(workspaceId)).rejects.toThrow(
        error,
      );
    });

    it('should propagate errors from create', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(null);

      const error = new Error('create failed');

      settingsRepository.create.mockRejectedValue(error);

      await expect(service.createDefaultSettings(workspaceId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(existingSettings);

      const updates = {
        timezone: 'UTC',
        emailNotifications: false,
      };

      settingsRepository.update.mockResolvedValue(existingSettings);

      const result = await service.updateSettings(workspaceId, updates);

      expect(settingsRepository.findByWorkspaceId).toHaveBeenCalledWith(
        workspaceId,
      );

      expect(settingsRepository.update).toHaveBeenCalledWith(
        workspaceId,
        updates,
      );

      expect(result).toBe(existingSettings);
    });

    it('should create settings with defaults when settings do not exist', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(null);
      settingsRepository.create.mockResolvedValue(createdSettings);

      const updates = {
        timezone: 'UTC',
        emailNotifications: false,
      };

      const result = await service.updateSettings(workspaceId, updates);

      expect(settingsRepository.findByWorkspaceId).toHaveBeenCalledWith(
        workspaceId,
      );

      expect(settingsRepository.create).toHaveBeenCalledTimes(1);

      const entity = settingsRepository.create.mock.calls[0][0];

      expect(entity).toBeInstanceOf(WorkspaceSettingsEntity);

      expect(entity).toEqual(
        expect.objectContaining({
          workspaceId,
          timezone: 'UTC',
          defaultTaskPriority: DEFAULT_WORKSPACE_SETTINGS.defaultTaskPriority,
          defaultTaskStatus: DEFAULT_WORKSPACE_SETTINGS.defaultTaskStatus,
          emailNotifications: false,
          taskAssignmentNotifications:
            DEFAULT_WORKSPACE_SETTINGS.taskAssignmentNotifications,
        }),
      );

      expect(result).toBe(createdSettings);
    });

    it('should use all provided settings when creating new settings', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(null);
      settingsRepository.create.mockResolvedValue(createdSettings);

      const updates = {
        timezone: 'Europe/London',
        defaultTaskPriority: TaskPriority.High,
        defaultTaskStatus: TaskStatus.Done,
        emailNotifications: false,
        taskAssignmentNotifications: false,
      };

      await service.updateSettings(workspaceId, updates);

      const entity = settingsRepository.create.mock.calls[0][0];

      expect(entity).toEqual(
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

    it('should propagate errors from findByWorkspaceId', async () => {
      const error = new Error('database error');

      settingsRepository.findByWorkspaceId.mockRejectedValue(error);

      await expect(
        service.updateSettings(workspaceId, {
          timezone: 'UTC',
        }),
      ).rejects.toThrow(error);
    });

    it('should propagate errors from update', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(existingSettings);

      const error = new Error('update failed');

      settingsRepository.update.mockRejectedValue(error);

      await expect(
        service.updateSettings(workspaceId, {
          timezone: 'UTC',
        }),
      ).rejects.toThrow(error);
    });

    it('should propagate errors from create when settings do not exist', async () => {
      settingsRepository.findByWorkspaceId.mockResolvedValue(null);

      const error = new Error('create failed');

      settingsRepository.create.mockRejectedValue(error);

      await expect(
        service.updateSettings(workspaceId, {
          timezone: 'UTC',
        }),
      ).rejects.toThrow(error);
    });
  });
});
