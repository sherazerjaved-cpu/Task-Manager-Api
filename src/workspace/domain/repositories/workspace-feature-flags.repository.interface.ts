import { WorkspaceFeatureFlagsEntity } from '../entities/workspace-feature-flags.entity';
import { WorkspaceFeatureFlag } from '../enums/workspace-feature-flag.enum';

export interface WorkspaceFeatureFlagsRepository {
  findByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceFeatureFlagsEntity | null>;

  create(
    entity: WorkspaceFeatureFlagsEntity,
  ): Promise<WorkspaceFeatureFlagsEntity>;

  update(
    workspaceId: string,
    flags: Partial<Record<WorkspaceFeatureFlag, boolean>>,
  ): Promise<WorkspaceFeatureFlagsEntity>;
}
