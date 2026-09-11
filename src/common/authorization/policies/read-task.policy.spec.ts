import { readTaskPolicy } from './read-task.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('readTaskPolicy', () => {
  it('should return true when the ability allows reading tasks', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = readTaskPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Task);
  });

  it('should return false when the ability denies reading tasks', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = readTaskPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Task);
  });
});
