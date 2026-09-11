import { downloadExportPolicy } from './download-export.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('downloadExportPolicy', () => {
  it('should return true when the ability allows reading exports', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = downloadExportPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Export);
  });

  it('should return false when the ability denies reading exports', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = downloadExportPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Export);
  });
});
