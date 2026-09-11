import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { AuditContextInterceptor } from './audit-context.interceptor';
import { AuditContext } from './audit-context';

describe('AuditContextInterceptor', () => {
  let interceptor: AuditContextInterceptor;
  let auditContext: jest.Mocked<AuditContext>;
  let executionContext: jest.Mocked<ExecutionContext>;
  let next: jest.Mocked<CallHandler>;

  beforeEach(() => {
    auditContext = {
      setIp: jest.fn(),
      getIp: jest.fn(),
    } as unknown as jest.Mocked<AuditContext>;

    executionContext = {
      switchToHttp: jest.fn(),
    } as unknown as jest.Mocked<ExecutionContext>;

    next = {
      handle: jest.fn(),
    } as unknown as jest.Mocked<CallHandler>;

    interceptor = new AuditContextInterceptor(auditContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should store request.ip in the audit context', () => {
      const request = {
        ip: '192.168.1.100',
        socket: {
          remoteAddress: '10.0.0.1',
        },
      };

      const httpContext = {
        getRequest: jest.fn().mockReturnValue(request),
      };

      executionContext.switchToHttp.mockReturnValue(httpContext as any);

      const response$ = of({ success: true });

      next.handle.mockReturnValue(response$);

      const result = interceptor.intercept(executionContext, next);

      expect(executionContext.switchToHttp.mock.calls).toHaveLength(1);
      expect(httpContext.getRequest.mock.calls).toHaveLength(1);

      expect(auditContext.setIp.mock.calls).toHaveLength(1);
      expect(auditContext.setIp.mock.calls).toContainEqual(['192.168.1.100']);

      expect(next.handle.mock.calls).toHaveLength(1);
      expect(result).toBe(response$);
    });

    it('should fall back to socket.remoteAddress when request.ip is unavailable', () => {
      const request = {
        socket: {
          remoteAddress: '10.0.0.25',
        },
      };

      const httpContext = {
        getRequest: jest.fn().mockReturnValue(request),
      };

      executionContext.switchToHttp.mockReturnValue(httpContext as any);

      const response$ = of({ success: true });

      next.handle.mockReturnValue(response$);

      const result = interceptor.intercept(executionContext, next);

      expect(auditContext.setIp.mock.calls).toContainEqual(['10.0.0.25']);

      expect(next.handle.mock.calls).toHaveLength(1);
      expect(result).toBe(response$);
    });

    it('should set undefined when neither request.ip nor socket.remoteAddress exists', () => {
      const request = {
        socket: {},
      };

      const httpContext = {
        getRequest: jest.fn().mockReturnValue(request),
      };

      executionContext.switchToHttp.mockReturnValue(httpContext as any);

      const response$ = of({ success: true });

      next.handle.mockReturnValue(response$);

      const result = interceptor.intercept(executionContext, next);

      expect(auditContext.setIp.mock.calls).toHaveLength(1);
      expect(auditContext.setIp.mock.calls).toContainEqual([undefined]);

      expect(next.handle.mock.calls).toHaveLength(1);
      expect(result).toBe(response$);
    });

    it('should prefer request.ip over socket.remoteAddress', () => {
      const request = {
        ip: '203.0.113.10',
        socket: {
          remoteAddress: '10.0.0.10',
        },
      };

      const httpContext = {
        getRequest: jest.fn().mockReturnValue(request),
      };

      executionContext.switchToHttp.mockReturnValue(httpContext as any);

      const response$ = of('response');

      next.handle.mockReturnValue(response$);

      interceptor.intercept(executionContext, next);

      expect(auditContext.setIp.mock.calls).toContainEqual(['203.0.113.10']);

      expect(auditContext.setIp.mock.calls).not.toContainEqual(['10.0.0.10']);
    });

    it('should call next.handle exactly once', () => {
      const request = {
        ip: '127.0.0.1',
      };

      const httpContext = {
        getRequest: jest.fn().mockReturnValue(request),
      };

      executionContext.switchToHttp.mockReturnValue(httpContext as any);

      next.handle.mockReturnValue(of('response'));

      interceptor.intercept(executionContext, next);

      expect(next.handle.mock.calls).toHaveLength(1);
    });
  });
});
