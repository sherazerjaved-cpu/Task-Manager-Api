import { readCommentPolicy } from './read-comment.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('readCommentPolicy', () => {
  it('should return true when the ability allows reading comments', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = readCommentPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Comment);
  });

  it('should return false when the ability denies reading comments', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = readCommentPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Comment);
  });
});
