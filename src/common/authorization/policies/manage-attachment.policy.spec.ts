import { manageAttachmentPolicy } from './manage-attachment.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('manageAttachmentPolicy', () => {
  it('should return true when the ability allows managing attachments', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = manageAttachmentPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Attachment);
  });

  it('should return false when the ability denies managing attachments', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = manageAttachmentPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Attachment);
  });
});
