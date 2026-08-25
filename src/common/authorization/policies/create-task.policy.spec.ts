import { createTaskPolicy } from './create-task.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('createTaskPolicy', () => {
  let ability: {
    can: jest.Mock;
  };

  beforeEach(() => {
    ability = {
      can: jest.fn(),
    };
  });

  it('should return true when the ability allows creating tasks', () => {
    ability.can.mockReturnValue(true);

    const result = createTaskPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Create, Subject.Task);
  });

  it('should return false when the ability does not allow creating tasks', () => {
    ability.can.mockReturnValue(false);

    const result = createTaskPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Create, Subject.Task);
  });
});
