import { GetFeatureFlagsHandler } from './get-feature-flags.handler';
import { GetFeatureFlagsQuery } from './get-feature-flags.query';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { WorkspaceFeatureFlag } from '../../../domain/enums/workspace-feature-flag.enum';

describe('GetFeatureFlagsHandler', () => {
  let handler: GetFeatureFlagsHandler;
  let featureFlagsService: jest.Mocked<FeatureFlagsService>;

  const workspaceId = 'workspace-123';

  const flags: Record<WorkspaceFeatureFlag, boolean> = {
    [WorkspaceFeatureFlag.WEBHOOKS]: true,
    [WorkspaceFeatureFlag.EXPORTS]: false,
    [WorkspaceFeatureFlag.REMINDERS]: true,
    [WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS]: true,
    [WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING]: false,
  };

  beforeEach(() => {
    featureFlagsService = {
      getFlags: jest.fn(),
    } as unknown as jest.Mocked<FeatureFlagsService>;

    handler = new GetFeatureFlagsHandler(featureFlagsService);
  });

  describe('execute', () => {
    it('should call featureFlagsService.getFlags with the workspace ID', async () => {
      featureFlagsService.getFlags.mockResolvedValue(flags);

      const query = new GetFeatureFlagsQuery(workspaceId);

      await handler.execute(query);

      expect(featureFlagsService.getFlags).toHaveBeenCalledTimes(1);
      expect(featureFlagsService.getFlags).toHaveBeenCalledWith(workspaceId);
    });

    it('should return the feature flags from the service', async () => {
      featureFlagsService.getFlags.mockResolvedValue(flags);

      const query = new GetFeatureFlagsQuery(workspaceId);

      const result = await handler.execute(query);

      expect(result).toEqual(flags);
    });

    it('should return the exact object returned by the service', async () => {
      featureFlagsService.getFlags.mockResolvedValue(flags);

      const query = new GetFeatureFlagsQuery(workspaceId);

      const result = await handler.execute(query);

      expect(result).toBe(flags);
    });

    it('should return an empty object when the service returns no flags', async () => {
      const emptyFlags = {} as Record<WorkspaceFeatureFlag, boolean>;

      featureFlagsService.getFlags.mockResolvedValue(emptyFlags);

      const query = new GetFeatureFlagsQuery(workspaceId);

      const result = await handler.execute(query);

      expect(result).toEqual({});
    });

    it('should propagate errors from featureFlagsService.getFlags', async () => {
      const error = new Error('Failed to get feature flags');

      featureFlagsService.getFlags.mockRejectedValue(error);

      const query = new GetFeatureFlagsQuery(workspaceId);

      await expect(handler.execute(query)).rejects.toThrow(
        'Failed to get feature flags',
      );

      expect(featureFlagsService.getFlags).toHaveBeenCalledWith(workspaceId);
    });
  });
});
