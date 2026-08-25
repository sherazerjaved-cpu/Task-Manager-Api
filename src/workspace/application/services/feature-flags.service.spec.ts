import { Test, TestingModule } from '@nestjs/testing';

import { FeatureFlagsService } from './feature-flags.service';

import { WorkspaceFeatureFlagsEntity } from '../../domain/entities/workspace-feature-flags.entity';
import { WorkspaceFeatureFlag } from '../../domain/enums/workspace-feature-flag.enum';
import { DEFAULT_WORKSPACE_FEATURE_FLAGS } from '../../domain/constants/default-workspace-feature-flags';
import { WORKSPACE_FEATURE_FLAGS_REPOSITORY } from '../../domain/constants/repository.tokens';

import type { WorkspaceFeatureFlagsRepository } from '../../domain/repositories/workspace-feature-flags.repository.interface';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  let featureFlagsRepository: jest.Mocked<WorkspaceFeatureFlagsRepository>;

  beforeEach(async () => {
    featureFlagsRepository = {
      findByWorkspaceId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: WORKSPACE_FEATURE_FLAGS_REPOSITORY,
          useValue: featureFlagsRepository,
        },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEnabled', () => {
    it('should return the configured flag value when configuration exists', async () => {
      const workspaceId = 'workspace-123';

      const configuration = {
        workspaceId,
        flags: {
          [WorkspaceFeatureFlag.WEBHOOKS]: true,
        },
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(
        configuration as any,
      );

      const result = await service.isEnabled(
        workspaceId,
        WorkspaceFeatureFlag.WEBHOOKS,
      );

      expect(result).toBe(true);

      expect(featureFlagsRepository.findByWorkspaceId).toHaveBeenCalledWith(
        workspaceId,
      );
    });

    it('should return false when a configured flag is explicitly false', async () => {
      const workspaceId = 'workspace-123';

      const configuration = {
        workspaceId,
        flags: {
          [WorkspaceFeatureFlag.WEBHOOKS]: false,
        },
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(
        configuration as any,
      );

      const result = await service.isEnabled(
        workspaceId,
        WorkspaceFeatureFlag.WEBHOOKS,
      );

      expect(result).toBe(false);
    });

    it('should return the default flag value when configuration does not exist', async () => {
      const workspaceId = 'workspace-123';

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(null);

      const result = await service.isEnabled(
        workspaceId,
        WorkspaceFeatureFlag.WEBHOOKS,
      );

      expect(result).toBe(
        DEFAULT_WORKSPACE_FEATURE_FLAGS[WorkspaceFeatureFlag.WEBHOOKS] ?? false,
      );
    });

    it('should return false when a missing flag has no default value', async () => {
      const workspaceId = 'workspace-123';

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue({
        workspaceId,
        flags: {},
      } as any);

      const result = await service.isEnabled(
        workspaceId,
        WorkspaceFeatureFlag.WEBHOOKS,
      );

      expect(result).toBe(false);
    });

    it('should propagate errors from findByWorkspaceId', async () => {
      const workspaceId = 'workspace-123';

      const error = new Error('Database error');

      featureFlagsRepository.findByWorkspaceId.mockRejectedValue(error);

      await expect(
        service.isEnabled(workspaceId, WorkspaceFeatureFlag.WEBHOOKS),
      ).rejects.toThrow(error);
    });
  });

  describe('getFlags', () => {
    it('should return default flags when configuration does not exist', async () => {
      const workspaceId = 'workspace-123';

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(null);

      const result = await service.getFlags(workspaceId);

      expect(result).toEqual({
        ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
      });

      expect(featureFlagsRepository.findByWorkspaceId).toHaveBeenCalledWith(
        workspaceId,
      );
    });

    it('should merge configured flags with default flags', async () => {
      const workspaceId = 'workspace-123';

      const configuration = {
        workspaceId,
        flags: {
          [WorkspaceFeatureFlag.WEBHOOKS]: true,
        },
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(
        configuration as any,
      );

      const result = await service.getFlags(workspaceId);

      expect(result).toEqual({
        ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
        ...configuration.flags,
      });
    });

    it('should allow configured values to override defaults', async () => {
      const workspaceId = 'workspace-123';

      const configuration = {
        workspaceId,
        flags: {
          [WorkspaceFeatureFlag.WEBHOOKS]:
            !DEFAULT_WORKSPACE_FEATURE_FLAGS[WorkspaceFeatureFlag.WEBHOOKS],
        },
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(
        configuration as any,
      );

      const result = await service.getFlags(workspaceId);

      expect(result[WorkspaceFeatureFlag.WEBHOOKS]).toBe(
        configuration.flags[WorkspaceFeatureFlag.WEBHOOKS],
      );
    });

    it('should propagate errors from findByWorkspaceId', async () => {
      const workspaceId = 'workspace-123';

      const error = new Error('Database error');

      featureFlagsRepository.findByWorkspaceId.mockRejectedValue(error);

      await expect(service.getFlags(workspaceId)).rejects.toThrow(error);
    });
  });

  describe('createDefaultConfiguration', () => {
    it('should return the existing configuration when one already exists', async () => {
      const workspaceId = 'workspace-123';

      const existing = {
        workspaceId,
        flags: {
          ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
        },
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(
        existing as any,
      );

      const result = await service.createDefaultConfiguration(workspaceId);

      expect(result).toBe(existing);

      expect(featureFlagsRepository.create).not.toHaveBeenCalled();
    });

    it('should create a default configuration when one does not exist', async () => {
      const workspaceId = 'workspace-123';

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(null);

      const created = new WorkspaceFeatureFlagsEntity(workspaceId, {
        ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
      });

      featureFlagsRepository.create.mockResolvedValue(created);

      const result = await service.createDefaultConfiguration(workspaceId);

      expect(featureFlagsRepository.create).toHaveBeenCalledTimes(1);

      expect(featureFlagsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          flags: {
            ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
          },
        }),
      );

      expect(result).toBe(created);
    });

    it('should propagate errors from findByWorkspaceId', async () => {
      const workspaceId = 'workspace-123';

      const error = new Error('Database error');

      featureFlagsRepository.findByWorkspaceId.mockRejectedValue(error);

      await expect(
        service.createDefaultConfiguration(workspaceId),
      ).rejects.toThrow(error);

      expect(featureFlagsRepository.create).not.toHaveBeenCalled();
    });

    it('should propagate errors from create', async () => {
      const workspaceId = 'workspace-123';

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(null);

      const error = new Error('Create failed');

      featureFlagsRepository.create.mockRejectedValue(error);

      await expect(
        service.createDefaultConfiguration(workspaceId),
      ).rejects.toThrow(error);
    });
  });

  describe('updateFlags', () => {
    it('should create a new configuration with defaults and provided flags when none exists', async () => {
      const workspaceId = 'workspace-123';

      const flags = {
        [WorkspaceFeatureFlag.WEBHOOKS]: true,
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(null);

      const created = new WorkspaceFeatureFlagsEntity(workspaceId, {
        ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
        ...flags,
      });

      featureFlagsRepository.create.mockResolvedValue(created);

      const result = await service.updateFlags(workspaceId, flags);

      expect(featureFlagsRepository.create).toHaveBeenCalledTimes(1);

      expect(featureFlagsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          flags: {
            ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
            ...flags,
          },
        }),
      );

      expect(result).toBe(created);

      expect(featureFlagsRepository.update).not.toHaveBeenCalled();
    });

    it('should update the existing configuration when one exists', async () => {
      const workspaceId = 'workspace-123';

      const existing = {
        workspaceId,
        flags: {
          ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
        },
      };

      const flags = {
        [WorkspaceFeatureFlag.WEBHOOKS]: true,
        [WorkspaceFeatureFlag.EXPORTS]: false,
      };

      const updated = {
        workspaceId,
        flags: {
          ...existing.flags,
          ...flags,
        },
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(
        existing as any,
      );

      featureFlagsRepository.update.mockResolvedValue(updated as any);

      const result = await service.updateFlags(workspaceId, flags);

      expect(featureFlagsRepository.update).toHaveBeenCalledWith(
        workspaceId,
        flags,
      );

      expect(featureFlagsRepository.update).toHaveBeenCalledTimes(1);

      expect(result).toBe(updated);

      expect(featureFlagsRepository.create).not.toHaveBeenCalled();
    });

    it('should propagate errors from findByWorkspaceId', async () => {
      const workspaceId = 'workspace-123';

      const flags = {
        [WorkspaceFeatureFlag.WEBHOOKS]: true,
      };

      const error = new Error('Database error');

      featureFlagsRepository.findByWorkspaceId.mockRejectedValue(error);

      await expect(service.updateFlags(workspaceId, flags)).rejects.toThrow(
        error,
      );

      expect(featureFlagsRepository.create).not.toHaveBeenCalled();

      expect(featureFlagsRepository.update).not.toHaveBeenCalled();
    });

    it('should propagate errors from create when configuration does not exist', async () => {
      const workspaceId = 'workspace-123';

      const flags = {
        [WorkspaceFeatureFlag.WEBHOOKS]: true,
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(null);

      const error = new Error('Create failed');

      featureFlagsRepository.create.mockRejectedValue(error);

      await expect(service.updateFlags(workspaceId, flags)).rejects.toThrow(
        error,
      );
    });

    it('should propagate errors from update when configuration exists', async () => {
      const workspaceId = 'workspace-123';

      const flags = {
        [WorkspaceFeatureFlag.WEBHOOKS]: true,
      };

      const existing = {
        workspaceId,
        flags: {
          ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
        },
      };

      featureFlagsRepository.findByWorkspaceId.mockResolvedValue(
        existing as any,
      );

      const error = new Error('Update failed');

      featureFlagsRepository.update.mockRejectedValue(error);

      await expect(service.updateFlags(workspaceId, flags)).rejects.toThrow(
        error,
      );
    });
  });
});
