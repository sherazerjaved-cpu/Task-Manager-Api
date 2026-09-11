import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import { AppAbility } from '../app-ability';

export const createCommentPolicy = (ability: AppAbility): boolean => {
  return ability.can(Action.Create, Subject.Comment);
};
