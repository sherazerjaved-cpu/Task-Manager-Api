import { createWorkspacePolicy } from './create-workspace.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('createWorkspacePolicy', () => {
  let ability: {
    can: jest.Mock;
  };

  beforeEach(() => {
    ability = {
      can: jest.fn(),
    };
  });

  it('should return true when the ability allows creating workspaces', () => {
    ability.can.mockReturnValue(true);

    const result = createWorkspacePolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Create, Subject.Workspace);
  });

  it('should return false when the ability does not allow creating workspaces', () => {
    ability.can.mockReturnValue(false);

    const result = createWorkspacePolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Create, Subject.Workspace);
  });
});
