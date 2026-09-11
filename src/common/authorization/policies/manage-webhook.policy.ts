import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import { AppAbility } from '../app-ability';

export const manageWebhookPolicy = (ability: AppAbility): boolean => {
  return ability.can(Action.Manage, Subject.Webhook);
};
