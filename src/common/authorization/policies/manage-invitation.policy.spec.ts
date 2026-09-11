import { manageInvitationPolicy } from './manage-invitation.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('manageInvitationPolicy', () => {
  it('should return true when the ability allows managing invitations', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = manageInvitationPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Invitation);
  });

  it('should return false when the ability denies managing invitations', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = manageInvitationPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Manage, Subject.Invitation);
  });
});
