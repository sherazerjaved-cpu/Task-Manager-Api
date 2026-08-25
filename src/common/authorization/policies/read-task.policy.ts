import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import { AppAbility } from '../app-ability';

export const readTaskPolicy = (ability: AppAbility): boolean => {
  return ability.can(Action.Read, Subject.Task);
};
