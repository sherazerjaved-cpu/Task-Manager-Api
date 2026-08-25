import { subject } from '@casl/ability';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import { AppAbility } from '../app-ability';

export const deleteTaskPolicy = (
  ability: AppAbility,
  request: any,
): boolean => {
  const task = request.task;

  if (!task) {
    return false;
  }

  return ability.can(Action.Delete, subject(Subject.Task, task));
};
