import { readAttachmentPolicy } from './read-attachment.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('readAttachmentPolicy', () => {
  it('should return true when the ability allows reading attachments', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = readAttachmentPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Attachment);
  });

  it('should return false when the ability denies reading attachments', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = readAttachmentPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.Attachment);
  });
});
