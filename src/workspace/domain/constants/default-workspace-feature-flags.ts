import { WorkspaceFeatureFlag } from '../enums/workspace-feature-flag.enum';

export const DEFAULT_WORKSPACE_FEATURE_FLAGS: Record<
  WorkspaceFeatureFlag,
  boolean
> = {
  [WorkspaceFeatureFlag.WEBHOOKS]: true,
  [WorkspaceFeatureFlag.EXPORTS]: true,
  [WorkspaceFeatureFlag.REMINDERS]: true,
  [WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS]: true,
  [WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING]: false,
};
