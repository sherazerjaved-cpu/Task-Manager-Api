import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import { AppAbility } from '../app-ability';

export const readAttachmentPolicy = (ability: AppAbility): boolean => {
  return ability.can(Action.Read, Subject.Attachment);
};
