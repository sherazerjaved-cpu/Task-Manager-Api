import { manageMemberPolicy } from './manage-member.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('manageMemberPolicy', () => {
  it('should return true when the ability allows managing members', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = manageMemberPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Member);
  });

  it('should return false when the ability denies managing members', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = manageMemberPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Member);
  });
});
