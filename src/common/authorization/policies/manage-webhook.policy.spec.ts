import { manageWebhookPolicy } from './manage-webhook.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('manageWebhookPolicy', () => {
  it('should return true when the ability allows managing webhooks', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = manageWebhookPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Webhook);
  });

  it('should return false when the ability denies managing webhooks', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = manageWebhookPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Webhook);
  });
});
