import { updateWorkspaceSettingsPolicy } from './update-workspace-settings.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('updateWorkspaceSettingsPolicy', () => {
  it('should return true when the ability allows managing workspace settings', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = updateWorkspaceSettingsPolicy(
      ability as unknown as AppAbility,
    );

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Workspace);
  });

  it('should return false when the ability denies managing workspace settings', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = updateWorkspaceSettingsPolicy(
      ability as unknown as AppAbility,
    );

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Workspace);
  });
});
