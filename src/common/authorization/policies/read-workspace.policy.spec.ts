import { readWorkspacePolicy } from './read-workspace.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('readWorkspacePolicy', () => {
  it('should return true when the ability allows reading workspaces', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = readWorkspacePolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Workspace);
  });

  it('should return false when the ability denies reading workspaces', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = readWorkspacePolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Workspace);
  });
});
