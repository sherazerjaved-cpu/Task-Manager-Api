import { Test, TestingModule } from '@nestjs/testing';
import { UpdateFeatureFlagsHandler } from './update-feature-flags.handler';
import { UpdateFeatureFlagsCommand } from './update-feature-flags.command';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { WorkspaceFeatureFlag } from '../../../domain/enums/workspace-feature-flag.enum';

describe('UpdateFeatureFlagsHandler', () => {
  let handler: UpdateFeatureFlagsHandler;
  let featureFlagsService: {
    updateFlags: jest.Mock;
  };

  beforeEach(async () => {
    featureFlagsService = {
      updateFlags: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateFeatureFlagsHandler,
        {
          provide: FeatureFlagsService,
          useValue: featureFlagsService,
        },
      ],
    }).compile();

    handler = module.get<UpdateFeatureFlagsHandler>(UpdateFeatureFlagsHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    const workspaceId = 'workspace-123';

    it('should update the webhooks flag', async () => {
      const result = {
        webhooks: true,
      };

      featureFlagsService.updateFlags.mockResolvedValue(result);

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        webhooks: true,
      });

      await expect(handler.execute(command)).resolves.toEqual(result);

      expect(featureFlagsService.updateFlags).toHaveBeenCalledWith(
        workspaceId,
        {
          [WorkspaceFeatureFlag.WEBHOOKS]: true,
        },
      );
    });

    it('should update the exports flag', async () => {
      featureFlagsService.updateFlags.mockResolvedValue({
        exports: false,
      });

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        exports: false,
      });

      await handler.execute(command);

      expect(featureFlagsService.updateFlags).toHaveBeenCalledWith(
        workspaceId,
        {
          [WorkspaceFeatureFlag.EXPORTS]: false,
        },
      );
    });

    it('should update the reminders flag', async () => {
      featureFlagsService.updateFlags.mockResolvedValue({
        reminders: true,
      });

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        reminders: true,
      });

      await handler.execute(command);

      expect(featureFlagsService.updateFlags).toHaveBeenCalledWith(
        workspaceId,
        {
          [WorkspaceFeatureFlag.REMINDERS]: true,
        },
      );
    });

    it('should update the email notifications flag', async () => {
      featureFlagsService.updateFlags.mockResolvedValue({
        emailNotifications: false,
      });

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        emailNotifications: false,
      });

      await handler.execute(command);

      expect(featureFlagsService.updateFlags).toHaveBeenCalledWith(
        workspaceId,
        {
          [WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS]: false,
        },
      );
    });

    it('should update the advanced task filtering flag', async () => {
      featureFlagsService.updateFlags.mockResolvedValue({
        advancedTaskFiltering: true,
      });

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        advancedTaskFiltering: true,
      });

      await handler.execute(command);

      expect(featureFlagsService.updateFlags).toHaveBeenCalledWith(
        workspaceId,
        {
          [WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING]: true,
        },
      );
    });

    it('should update multiple feature flags at once', async () => {
      featureFlagsService.updateFlags.mockResolvedValue({
        success: true,
      });

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        webhooks: true,
        exports: false,
        reminders: true,
        emailNotifications: false,
        advancedTaskFiltering: true,
      });

      await handler.execute(command);

      expect(featureFlagsService.updateFlags).toHaveBeenCalledWith(
        workspaceId,
        {
          [WorkspaceFeatureFlag.WEBHOOKS]: true,
          [WorkspaceFeatureFlag.EXPORTS]: false,
          [WorkspaceFeatureFlag.REMINDERS]: true,
          [WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS]: false,
          [WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING]: true,
        },
      );
    });

    it('should pass an empty flags object when no flags are provided', async () => {
      featureFlagsService.updateFlags.mockResolvedValue({
        success: true,
      });

      const command = new UpdateFeatureFlagsCommand(workspaceId, {});

      await handler.execute(command);

      expect(featureFlagsService.updateFlags).toHaveBeenCalledWith(
        workspaceId,
        {},
      );
    });

    it('should correctly handle false values', async () => {
      featureFlagsService.updateFlags.mockResolvedValue({
        success: true,
      });

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        webhooks: false,
        exports: false,
        reminders: false,
        emailNotifications: false,
        advancedTaskFiltering: false,
      });

      await handler.execute(command);

      expect(featureFlagsService.updateFlags).toHaveBeenCalledWith(
        workspaceId,
        {
          [WorkspaceFeatureFlag.WEBHOOKS]: false,
          [WorkspaceFeatureFlag.EXPORTS]: false,
          [WorkspaceFeatureFlag.REMINDERS]: false,
          [WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS]: false,
          [WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING]: false,
        },
      );
    });

    it('should return the result from featureFlagsService.updateFlags', async () => {
      const serviceResult = {
        webhooks: true,
        exports: false,
      };

      featureFlagsService.updateFlags.mockResolvedValue(serviceResult);

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        webhooks: true,
        exports: false,
      });

      const result = await handler.execute(command);

      expect(result).toEqual(serviceResult);
    });

    it('should propagate errors from featureFlagsService.updateFlags', async () => {
      const error = new Error('Failed to update feature flags');

      featureFlagsService.updateFlags.mockRejectedValue(error);

      const command = new UpdateFeatureFlagsCommand(workspaceId, {
        webhooks: true,
      });

      await expect(handler.execute(command)).rejects.toThrow(
        'Failed to update feature flags',
      );
    });
  });
});
