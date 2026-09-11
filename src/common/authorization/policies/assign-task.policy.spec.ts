import { assignTaskPolicy } from './assign-task.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('assignTaskPolicy', () => {
  let ability: {
    can: jest.Mock;
  };

  beforeEach(() => {
    ability = {
      can: jest.fn(),
    };
  });

  it('should return true when the ability allows updating a task', () => {
    ability.can.mockReturnValue(true);

    const result = assignTaskPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);

    expect(ability.can).toHaveBeenCalledWith(Action.Update, Subject.Task);
  });

  it('should return false when the ability does not allow updating a task', () => {
    ability.can.mockReturnValue(false);

    const result = assignTaskPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);

    expect(ability.can).toHaveBeenCalledWith(Action.Update, Subject.Task);
  });

  it('should not depend on a request object', () => {
    ability.can.mockReturnValue(true);

    const result = assignTaskPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledTimes(1);
  });
});
