import { manageFeatureFlagsPolicy } from './manage-feature-flags.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('manageFeatureFlagsPolicy', () => {
  it('should return true when the ability allows managing workspace feature flags', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = manageFeatureFlagsPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Workspace);
  });

  it('should return false when the ability denies managing workspace feature flags', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = manageFeatureFlagsPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Workspace);
  });
});
