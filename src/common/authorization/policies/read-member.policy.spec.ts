import { readMemberPolicy } from './read-member.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('readMemberPolicy', () => {
  it('should return true when the ability allows reading members', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = readMemberPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Member);
  });

  it('should return false when the ability denies reading members', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = readMemberPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Member);
  });
});
