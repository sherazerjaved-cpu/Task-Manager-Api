import { readAuditLogPolicy } from './read-audit-log.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('readAuditLogPolicy', () => {
  it('should return true when the ability allows reading audit logs', () => {
    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const result = readAuditLogPolicy(ability as unknown as AppAbility);

    expect(result).toBe(true);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.AuditLog);
  });

  it('should return false when the ability denies reading audit logs', () => {
    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const result = readAuditLogPolicy(ability as unknown as AppAbility);

    expect(result).toBe(false);
    expect(ability.can).toHaveBeenCalledWith(Action.Read, Subject.AuditLog);
  });
});
