import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import { AppAbility } from '../app-ability';

export const assignTaskPolicy = (ability: AppAbility): boolean => {
  return ability.can(Action.Update, Subject.Task);
};
