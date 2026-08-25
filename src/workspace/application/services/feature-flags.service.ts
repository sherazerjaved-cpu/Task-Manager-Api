import { Inject, Injectable } from '@nestjs/common';

import { WorkspaceFeatureFlagsEntity } from '../../domain/entities/workspace-feature-flags.entity';
import { WorkspaceFeatureFlag } from '../../domain/enums/workspace-feature-flag.enum';
import type { WorkspaceFeatureFlagsRepository } from '../../domain/repositories/workspace-feature-flags.repository.interface';
import { DEFAULT_WORKSPACE_FEATURE_FLAGS } from '../../domain/constants/default-workspace-feature-flags';
import { WORKSPACE_FEATURE_FLAGS_REPOSITORY } from '../../domain/constants/repository.tokens';

@Injectable()
export class FeatureFlagsService {
  constructor(
    @Inject(WORKSPACE_FEATURE_FLAGS_REPOSITORY)
    private readonly featureFlagsRepository: WorkspaceFeatureFlagsRepository,
  ) {}

  async isEnabled(
    workspaceId: string,
    flag: WorkspaceFeatureFlag,
  ): Promise<boolean> {
    const configuration =
      await this.featureFlagsRepository.findByWorkspaceId(workspaceId);

    if (!configuration) {
      return DEFAULT_WORKSPACE_FEATURE_FLAGS[flag] ?? false;
    }

    return configuration.flags[flag] ?? false;
  }

  async getFlags(
    workspaceId: string,
  ): Promise<Record<WorkspaceFeatureFlag, boolean>> {
    const configuration =
      await this.featureFlagsRepository.findByWorkspaceId(workspaceId);

    if (!configuration) {
      return { ...DEFAULT_WORKSPACE_FEATURE_FLAGS };
    }

    return {
      ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
      ...configuration.flags,
    };
  }

  async createDefaultConfiguration(
    workspaceId: string,
  ): Promise<WorkspaceFeatureFlagsEntity> {
    const existing =
      await this.featureFlagsRepository.findByWorkspaceId(workspaceId);

    if (existing) {
      return existing;
    }

    return this.featureFlagsRepository.create(
      new WorkspaceFeatureFlagsEntity(workspaceId, {
        ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
      }),
    );
  }

  async updateFlags(
    workspaceId: string,
    flags: Partial<Record<WorkspaceFeatureFlag, boolean>>,
  ): Promise<WorkspaceFeatureFlagsEntity> {
    const existing =
      await this.featureFlagsRepository.findByWorkspaceId(workspaceId);

    if (!existing) {
      return this.featureFlagsRepository.create(
        new WorkspaceFeatureFlagsEntity(workspaceId, {
          ...DEFAULT_WORKSPACE_FEATURE_FLAGS,
          ...flags,
        }),
      );
    }

    return this.featureFlagsRepository.update(workspaceId, flags);
  }
}
