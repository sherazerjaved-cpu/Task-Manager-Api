import { createExportPolicy } from './create-export.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('createExportPolicy', () => {
  let ability: {
    can: jest.Mock;
  };

  beforeEach(() => {
    ability = {
      can: jest.fn(),
    };
  });

  it('should return true when the ability allows creating exports', () => {
    ability.can.mockReturnValue(true);

    const result = createExportPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Create, Subject.Export);
  });

  it('should return false when the ability does not allow creating exports', () => {
    ability.can.mockReturnValue(false);

    const result = createExportPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Create, Subject.Export);
  });
});
