import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import { AppAbility } from '../app-ability';

export const readWorkspacePolicy = (ability: AppAbility): boolean => {
  return ability.can(Action.Read, Subject.Workspace);
};
