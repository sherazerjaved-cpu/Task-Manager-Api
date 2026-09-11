import { AuditContext } from './audit-context';

describe('AuditContext', () => {
  let auditContext: AuditContext;

  beforeEach(() => {
    auditContext = new AuditContext();
  });

  describe('setIp', () => {
    it('should store the provided IP address', () => {
      auditContext.setIp('192.168.1.100');

      expect(auditContext.getIp()).toBe('192.168.1.100');
    });

    it('should allow the IP address to be undefined', () => {
      auditContext.setIp(undefined);

      expect(auditContext.getIp()).toBeUndefined();
    });

    it('should replace the previously stored IP address', () => {
      auditContext.setIp('192.168.1.100');
      auditContext.setIp('10.0.0.25');

      expect(auditContext.getIp()).toBe('10.0.0.25');
    });
  });

  describe('getIp', () => {
    it('should return undefined when no IP has been set', () => {
      expect(auditContext.getIp()).toBeUndefined();
    });

    it('should return the currently stored IP address', () => {
      auditContext.setIp('127.0.0.1');

      expect(auditContext.getIp()).toBe('127.0.0.1');
    });
  });
});
