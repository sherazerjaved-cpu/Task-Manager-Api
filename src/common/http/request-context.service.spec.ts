import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  describe('getRequestId', () => {
    it('should return undefined when there is no active context', () => {
      expect(service.getRequestId()).toBeUndefined();
    });

    it('should return the request ID from the active context', () => {
      const requestId = 'request-123';

      service.run({ requestId }, () => {
        expect(service.getRequestId()).toBe(requestId);
      });
    });
  });

  describe('run', () => {
    it('should execute the callback', () => {
      const callback = jest.fn();

      service.run({ requestId: 'request-123' }, callback);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should make the request ID available inside the callback', () => {
      service.run({ requestId: 'request-123' }, () => {
        expect(service.getRequestId()).toBe('request-123');
      });
    });

    it('should isolate contexts between nested calls', () => {
      service.run({ requestId: 'outer-request' }, () => {
        expect(service.getRequestId()).toBe('outer-request');

        service.run({ requestId: 'inner-request' }, () => {
          expect(service.getRequestId()).toBe('inner-request');
        });

        expect(service.getRequestId()).toBe('outer-request');
      });
    });

    it('should restore the outer context after the nested callback finishes', () => {
      service.run({ requestId: 'outer-request' }, () => {
        service.run({ requestId: 'inner-request' }, () => {
          expect(service.getRequestId()).toBe('inner-request');
        });

        expect(service.getRequestId()).toBe('outer-request');
      });
    });

    it('should return the callback result', () => {
      const result = service.run(
        { requestId: 'request-123' },
        () => 'callback-result',
      );

      expect(result).toBe('callback-result');
    });

    it('should support a callback returning an object', () => {
      const result = service.run({ requestId: 'request-123' }, () => ({
        success: true,
        requestId: service.getRequestId(),
      }));

      expect(result).toEqual({
        success: true,
        requestId: 'request-123',
      });
    });

    it('should propagate errors thrown by the callback', () => {
      const error = new Error('Something went wrong');

      expect(() => {
        service.run({ requestId: 'request-123' }, () => {
          throw error;
        });
      }).toThrow(error);
    });

    it('should not leak the context outside the run callback', () => {
      service.run({ requestId: 'request-123' }, () => {
        expect(service.getRequestId()).toBe('request-123');
      });

      expect(service.getRequestId()).toBeUndefined();
    });
  });
});
