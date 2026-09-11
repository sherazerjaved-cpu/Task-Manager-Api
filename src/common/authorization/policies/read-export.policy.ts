import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import { AppAbility } from '../app-ability';

export const readExportPolicy = (ability: AppAbility): boolean => {
  return ability.can(Action.Read, Subject.Export);
};
