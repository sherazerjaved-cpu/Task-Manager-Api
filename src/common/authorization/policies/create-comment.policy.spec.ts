import { createCommentPolicy } from './create-comment.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('createCommentPolicy', () => {
  let ability: {
    can: jest.Mock;
  };

  beforeEach(() => {
    ability = {
      can: jest.fn(),
    };
  });

  it('should return true when the ability allows creating comments', () => {
    ability.can.mockReturnValue(true);

    const result = createCommentPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Create, Subject.Comment);
  });

  it('should return false when the ability does not allow creating comments', () => {
    ability.can.mockReturnValue(false);

    const result = createCommentPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Create, Subject.Comment);
  });
});
