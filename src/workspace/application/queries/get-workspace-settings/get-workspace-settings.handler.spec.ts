import { Test, TestingModule } from '@nestjs/testing';

import { GetWorkspaceSettingsHandler } from './get-workspace-settings.handler';
import { GetWorkspaceSettingsQuery } from './get-workspace-settings.query';
import { WorkspaceSettingsService } from '../../services/workspace-settings.service';

describe('GetWorkspaceSettingsHandler', () => {
  let handler: GetWorkspaceSettingsHandler;

  let workspaceSettingsService: {
    getSettings: jest.Mock;
  };

  beforeEach(async () => {
    workspaceSettingsService = {
      getSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWorkspaceSettingsHandler,
        {
          provide: WorkspaceSettingsService,
          useValue: workspaceSettingsService,
        },
      ],
    }).compile();

    handler = module.get<GetWorkspaceSettingsHandler>(
      GetWorkspaceSettingsHandler,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should call workspaceSettingsService.getSettings with the workspace ID', async () => {
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      const query = new GetWorkspaceSettingsQuery(workspaceId, userId);

      const settings = {
        workspaceId,
        timezone: 'Asia/Karachi',
        defaultTaskPriority: 'medium',
        defaultTaskStatus: 'pending',
        emailNotifications: true,
        taskAssignmentNotifications: true,
      };

      workspaceSettingsService.getSettings.mockResolvedValue(settings);

      await handler.execute(query);

      expect(workspaceSettingsService.getSettings).toHaveBeenCalledWith(
        workspaceId,
      );

      expect(workspaceSettingsService.getSettings).toHaveBeenCalledTimes(1);
    });

    it('should return the settings from the service', async () => {
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      const query = new GetWorkspaceSettingsQuery(workspaceId, userId);

      const settings = {
        workspaceId,
        timezone: 'Asia/Karachi',
        defaultTaskPriority: 'medium',
        defaultTaskStatus: 'pending',
        emailNotifications: true,
        taskAssignmentNotifications: false,
      };

      workspaceSettingsService.getSettings.mockResolvedValue(settings);

      const result = await handler.execute(query);

      expect(result).toEqual(settings);
    });

    it('should propagate errors from workspaceSettingsService.getSettings', async () => {
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      const query = new GetWorkspaceSettingsQuery(workspaceId, userId);

      const error = new Error('Failed to get workspace settings');

      workspaceSettingsService.getSettings.mockRejectedValue(error);

      await expect(handler.execute(query)).rejects.toThrow(error);

      expect(workspaceSettingsService.getSettings).toHaveBeenCalledWith(
        workspaceId,
      );
    });
  });
});
