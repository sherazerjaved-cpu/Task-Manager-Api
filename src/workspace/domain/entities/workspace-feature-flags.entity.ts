import { WorkspaceFeatureFlag } from '../enums/workspace-feature-flag.enum';

export class WorkspaceFeatureFlagsEntity {
  constructor(
    public readonly workspaceId: string,
    public flags: Record<WorkspaceFeatureFlag, boolean>,
    public readonly createdAt?: Date,
    public updatedAt?: Date,
  ) {}
}
