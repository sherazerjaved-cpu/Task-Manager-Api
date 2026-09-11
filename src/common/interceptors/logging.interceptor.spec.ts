import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';

import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
    error: jest.Mock;
  };

  let request: {
    method: string;
    originalUrl?: string;
    url?: string;
    headers: Record<string, unknown>;
  };

  let response: {
    statusCode: number;
  };

  let context: ExecutionContext;
  let next: CallHandler;

  beforeEach(() => {
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    interceptor = new LoggingInterceptor(logger as unknown as PinoLogger);

    request = {
      method: 'GET',
      originalUrl: '/api/v1/tasks?page=1',
      url: '/api/v1/tasks?page=1',
      headers: {
        'x-request-id': 'request-123',
      },
    };

    response = {
      statusCode: 200,
    };

    context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn().mockReturnValue(response),
      }),
    } as unknown as ExecutionContext;

    next = {
      handle: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should set the logger context', () => {
      expect(logger.setContext).toHaveBeenCalledWith('LoggingInterceptor');
    });
  });

  describe('successful requests', () => {
    it('should call the next handler', async () => {
      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(next.handle).toHaveBeenCalledTimes(1);
    });

    it('should return the handler result', async () => {
      const result = {
        id: 'task-123',
        title: 'Test task',
      };

      next.handle = jest.fn().mockReturnValue(of(result));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).resolves.toEqual(result);
    });

    it('should log a successful request', async () => {
      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledTimes(1);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'request-123',
          method: 'GET',
          url: '/api/v1/tasks',
          statusCode: 200,
          durationMs: expect.any(Number),
        }),
        'HTTP request completed',
      );
    });

    it('should include the request ID in the log', async () => {
      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'request-123',
        }),
        'HTTP request completed',
      );
    });

    it('should include the HTTP method in the log', async () => {
      request.method = 'POST';

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
        }),
        'HTTP request completed',
      );
    });

    it('should include the response status code in the log', async () => {
      response.statusCode = 201;

      next.handle = jest.fn().mockReturnValue(of({ id: 'task-123' }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 201,
        }),
        'HTTP request completed',
      );
    });

    it('should include request duration in milliseconds', async () => {
      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: expect.any(Number),
        }),
        'HTTP request completed',
      );
    });
  });

  describe('URL sanitization', () => {
    it('should remove query parameters from the logged URL', async () => {
      request.originalUrl = '/api/v1/tasks?page=1&limit=20&sort=createdAt';

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/v1/tasks',
        }),
        'HTTP request completed',
      );
    });

    it('should remove URL query parameters containing sensitive data', async () => {
      request.originalUrl = '/api/v1/auth/reset-password?token=secret-token';

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      const loggedData = logger.info.mock.calls[0][0];

      expect(loggedData.url).toBe('/api/v1/auth/reset-password');

      expect(loggedData.url).not.toContain('secret-token');
    });

    it('should use request.url when originalUrl is unavailable', async () => {
      request.originalUrl = undefined;
      request.url = '/api/v1/tasks?page=2';

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/v1/tasks',
        }),
        'HTTP request completed',
      );
    });

    it('should redact an invalid URL', async () => {
      request.originalUrl = '://invalid-url';
      request.url = '://invalid-url';

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '[REDACTED_URL]',
        }),
        'HTTP request completed',
      );
    });
  });

  describe('request ID handling', () => {
    it('should use unknown when x-request-id is missing', async () => {
      request.headers = {};

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'unknown',
        }),
        'HTTP request completed',
      );
    });

    it('should use unknown when x-request-id is not a string', async () => {
      request.headers = {
        'x-request-id': 12345,
      };

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'unknown',
        }),
        'HTTP request completed',
      );
    });

    it('should use the supplied x-request-id', async () => {
      request.headers = {
        'x-request-id': 'custom-request-id',
      };

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'custom-request-id',
        }),
        'HTTP request completed',
      );
    });
  });

  describe('failed requests', () => {
    it('should log an error when the handler fails', async () => {
      const error = new Error('Something went wrong');

      next.handle = jest.fn().mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledTimes(1);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'request-123',
          method: 'GET',
          url: '/api/v1/tasks',
          statusCode: 200,
          durationMs: expect.any(Number),
          err: error,
        }),
        'HTTP request failed',
      );
    });

    it('should rethrow the original error', async () => {
      const error = new Error('Original error');

      next.handle = jest.fn().mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBe(error);
    });

    it('should not log a successful request when the handler fails', async () => {
      const error = new Error('Failure');

      next.handle = jest.fn().mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBe(error);

      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should log non-Error exceptions without an err object', async () => {
      next.handle = jest.fn().mockReturnValue(throwError(() => 'string error'));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBe('string error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'request-123',
          method: 'GET',
          url: '/api/v1/tasks',
          statusCode: 200,
          durationMs: expect.any(Number),
          err: undefined,
        }),
        'HTTP request failed',
      );
    });

    it('should preserve the request ID when logging failures', async () => {
      const error = new Error('Failure');

      request.headers = {
        'x-request-id': 'failure-request-123',
      };

      next.handle = jest.fn().mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'failure-request-123',
        }),
        'HTTP request failed',
      );
    });
  });

  describe('response status', () => {
    it('should log the current response status code', async () => {
      response.statusCode = 204;

      next.handle = jest.fn().mockReturnValue(of(null));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 204,
        }),
        'HTTP request completed',
      );
    });

    it('should log the current response status code for failures', async () => {
      response.statusCode = 500;

      const error = new Error('Internal error');

      next.handle = jest.fn().mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
        }),
        'HTTP request failed',
      );
    });
  });
});
