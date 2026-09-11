import { WorkspaceFeatureFlagsEntity } from './workspace-feature-flags.entity';
import { WorkspaceFeatureFlag } from '../enums/workspace-feature-flag.enum';

describe('WorkspaceFeatureFlagsEntity', () => {
  const workspaceId = 'workspace-123';

  const flags: Record<WorkspaceFeatureFlag, boolean> = {
    [WorkspaceFeatureFlag.WEBHOOKS]: true,
    [WorkspaceFeatureFlag.EXPORTS]: false,
    [WorkspaceFeatureFlag.REMINDERS]: true,
    [WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS]: true,
    [WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING]: false,
  };

  describe('constructor', () => {
    it('should create an entity with the provided values', () => {
      const createdAt = new Date('2026-08-18T10:00:00.000Z');
      const updatedAt = new Date('2026-08-18T11:00:00.000Z');

      const entity = new WorkspaceFeatureFlagsEntity(
        workspaceId,
        flags,
        createdAt,
        updatedAt,
      );

      expect(entity).toBeInstanceOf(WorkspaceFeatureFlagsEntity);

      expect(entity.workspaceId).toBe(workspaceId);
      expect(entity.flags).toBe(flags);
      expect(entity.createdAt).toBe(createdAt);
      expect(entity.updatedAt).toBe(updatedAt);
    });

    it('should allow createdAt and updatedAt to be omitted', () => {
      const entity = new WorkspaceFeatureFlagsEntity(workspaceId, flags);

      expect(entity).toBeInstanceOf(WorkspaceFeatureFlagsEntity);
      expect(entity.workspaceId).toBe(workspaceId);
      expect(entity.flags).toBe(flags);
      expect(entity.createdAt).toBeUndefined();
      expect(entity.updatedAt).toBeUndefined();
    });

    it('should preserve false feature flag values', () => {
      const entity = new WorkspaceFeatureFlagsEntity(workspaceId, {
        ...flags,
        [WorkspaceFeatureFlag.WEBHOOKS]: false,
        [WorkspaceFeatureFlag.EXPORTS]: false,
      });

      expect(entity.flags[WorkspaceFeatureFlag.WEBHOOKS]).toBe(false);
      expect(entity.flags[WorkspaceFeatureFlag.EXPORTS]).toBe(false);
    });

    it('should preserve the complete flags object', () => {
      const entity = new WorkspaceFeatureFlagsEntity(workspaceId, flags);

      expect(entity.flags).toEqual(flags);
    });
  });

  describe('property mutability', () => {
    it('should allow flags to be updated', () => {
      const entity = new WorkspaceFeatureFlagsEntity(workspaceId, { ...flags });

      entity.flags[WorkspaceFeatureFlag.WEBHOOKS] = false;

      expect(entity.flags[WorkspaceFeatureFlag.WEBHOOKS]).toBe(false);
    });

    it('should allow updatedAt to be changed', () => {
      const entity = new WorkspaceFeatureFlagsEntity(workspaceId, { ...flags });

      const updatedAt = new Date('2026-08-18T12:00:00.000Z');

      entity.updatedAt = updatedAt;

      expect(entity.updatedAt).toBe(updatedAt);
    });
  });
});
