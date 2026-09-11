import { Test, TestingModule } from '@nestjs/testing';
import { UpdateWorkspaceSettingsHandler } from './update-workspace-settings.handler';
import { UpdateWorkspaceSettingsCommand } from './update-workspace-settings.command';
import { WorkspaceSettingsService } from '../../services/workspace-settings.service';

describe('UpdateWorkspaceSettingsHandler', () => {
  let handler: UpdateWorkspaceSettingsHandler;

  let workspaceSettingsService: {
    updateSettings: jest.Mock;
  };

  beforeEach(async () => {
    workspaceSettingsService = {
      updateSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateWorkspaceSettingsHandler,
        {
          provide: WorkspaceSettingsService,
          useValue: workspaceSettingsService,
        },
      ],
    }).compile();

    handler = module.get<UpdateWorkspaceSettingsHandler>(
      UpdateWorkspaceSettingsHandler,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    const workspaceId = 'workspace-123';
    const userId = 'user-123';

    const dto = {
      timezone: 'Asia/Karachi',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    } as any;

    it('should call workspaceSettingsService.updateSettings with workspace ID and DTO', async () => {
      workspaceSettingsService.updateSettings.mockResolvedValue({
        workspaceId,
        ...dto,
      });

      const command = new UpdateWorkspaceSettingsCommand(
        workspaceId,
        dto,
        userId,
      );

      await handler.execute(command);

      expect(workspaceSettingsService.updateSettings).toHaveBeenCalledWith(
        workspaceId,
        dto,
      );
    });

    it('should return the result from workspaceSettingsService.updateSettings', async () => {
      const serviceResult = {
        workspaceId,
        ...dto,
      };

      workspaceSettingsService.updateSettings.mockResolvedValue(serviceResult);

      const command = new UpdateWorkspaceSettingsCommand(
        workspaceId,
        dto,
        userId,
      );

      const result = await handler.execute(command);

      expect(result).toEqual(serviceResult);
    });

    it('should propagate errors from workspaceSettingsService.updateSettings', async () => {
      const error = new Error('Failed to update workspace settings');

      workspaceSettingsService.updateSettings.mockRejectedValue(error);

      const command = new UpdateWorkspaceSettingsCommand(
        workspaceId,
        dto,
        userId,
      );

      await expect(handler.execute(command)).rejects.toThrow(
        'Failed to update workspace settings',
      );
    });

    it('should pass the exact DTO without modifying it', async () => {
      workspaceSettingsService.updateSettings.mockResolvedValue({
        success: true,
      });

      const command = new UpdateWorkspaceSettingsCommand(
        workspaceId,
        dto,
        userId,
      );

      await handler.execute(command);

      expect(workspaceSettingsService.updateSettings).toHaveBeenCalledWith(
        workspaceId,
        dto,
      );
    });
  });
});
