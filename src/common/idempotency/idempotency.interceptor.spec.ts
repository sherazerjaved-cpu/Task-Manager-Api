import {
  CallHandler,
  ConflictException,
  ExecutionContext,
} from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';

import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;

  let idempotencyService: {
    reserve: jest.Mock;
    complete: jest.Mock;
    delete: jest.Mock;
  };

  let request: any;
  let response: any;
  let context: ExecutionContext;
  let next: CallHandler;

  beforeEach(() => {
    idempotencyService = {
      reserve: jest.fn(),
      complete: jest.fn(),
      delete: jest.fn(),
    };

    interceptor = new IdempotencyInterceptor(
      idempotencyService as unknown as IdempotencyService,
    );

    request = {
      method: 'POST',
      baseUrl: '/api/v1/tasks',
      url: '/api/v1/tasks',
      originalUrl: '/api/v1/tasks',
      path: '/api/v1/tasks',
      body: {
        title: 'Test task',
      },
      user: {
        userId: 'user-123',
      },
      header: jest.fn(),
    };

    response = {
      statusCode: 201,
      status: jest.fn(),
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

  describe('header validation', () => {
    it('should reject when Idempotency-Key header is missing', async () => {
      request.header.mockReturnValue(undefined);

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow(ConflictException);

      expect(idempotencyService.reserve).not.toHaveBeenCalled();
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('should reject when Idempotency-Key is empty', async () => {
      request.header.mockReturnValue('');

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow('Idempotency-Key must not be empty.');

      expect(idempotencyService.reserve).not.toHaveBeenCalled();
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('should reject when Idempotency-Key contains only whitespace', async () => {
      request.header.mockReturnValue('   ');

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow('Idempotency-Key must not be empty.');

      expect(idempotencyService.reserve).not.toHaveBeenCalled();
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('should reject when Idempotency-Key exceeds 255 characters', async () => {
      const longKey = 'a'.repeat(256);

      request.header.mockReturnValue(longKey);

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow('Idempotency-Key must not exceed 255 characters.');

      expect(idempotencyService.reserve).not.toHaveBeenCalled();
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('should accept a 255 character Idempotency-Key', async () => {
      const key = 'a'.repeat(255);

      request.header.mockReturnValue(key);

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      idempotencyService.complete.mockResolvedValue(undefined);

      next.handle = jest.fn().mockReturnValue(of({ id: 'task-123' }));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).resolves.toEqual({
        id: 'task-123',
      });

      expect(idempotencyService.reserve).toHaveBeenCalled();
      expect(next.handle).toHaveBeenCalledTimes(1);
    });
  });

  describe('new idempotency request', () => {
    beforeEach(() => {
      request.header.mockReturnValue('key-123');

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      idempotencyService.complete.mockResolvedValue(undefined);
    });

    it('should reserve the idempotency key', async () => {
      next.handle = jest.fn().mockReturnValue(
        of({
          id: 'task-123',
        }),
      );

      await firstValueFrom(interceptor.intercept(context, next));

      expect(idempotencyService.reserve).toHaveBeenCalledTimes(1);

      expect(idempotencyService.reserve).toHaveBeenCalledWith(
        'user-123:POST:/api/v1/tasks',
        'key-123',
        expect.any(String),
      );
    });

    it('should call the next handler when the key is acquired', async () => {
      next.handle = jest.fn().mockReturnValue(
        of({
          id: 'task-123',
        }),
      );

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

    it('should complete the idempotency record after successful processing', async () => {
      const result = {
        id: 'task-123',
      };

      next.handle = jest.fn().mockReturnValue(of(result));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(idempotencyService.complete).toHaveBeenCalledTimes(1);

      expect(idempotencyService.complete).toHaveBeenCalledWith(
        'user-123:POST:/api/v1/tasks',
        'key-123',
        {
          status: 'COMPLETED',
          fingerprint: expect.any(String),
          statusCode: 201,
          responseBody: result,
        },
      );
    });

    it('should build a deterministic fingerprint for the same request', async () => {
      next.handle = jest.fn().mockReturnValue(of({ id: 'task-123' }));

      await firstValueFrom(interceptor.intercept(context, next));

      const firstFingerprint = idempotencyService.reserve.mock.calls[0][2];

      idempotencyService.reserve.mockClear();
      idempotencyService.complete.mockClear();

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      await firstValueFrom(interceptor.intercept(context, next));

      const secondFingerprint = idempotencyService.reserve.mock.calls[0][2];

      expect(secondFingerprint).toBe(firstFingerprint);
    });
  });

  describe('existing idempotency record', () => {
    beforeEach(() => {
      request.header.mockReturnValue('key-123');
    });

    it('should reject when the same key is used with a different fingerprint', async () => {
      idempotencyService.reserve.mockResolvedValue({
        acquired: false,
        record: {
          fingerprint: 'different-fingerprint',
          status: 'COMPLETED',
          statusCode: 201,
          responseBody: {
            id: 'old-task',
          },
        },
      });

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow(
        'The Idempotency-Key has already been used with a different request.',
      );

      expect(next.handle).not.toHaveBeenCalled();
    });

    it('should reject when the existing request is still processing', async () => {
      idempotencyService.reserve.mockImplementation(
        async (_scope, _key, currentFingerprint) => ({
          acquired: false,
          record: {
            fingerprint: currentFingerprint,
            status: 'PROCESSING',
          },
        }),
      );

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow(
        'A request with this Idempotency-Key is already being processed.',
      );

      expect(next.handle).not.toHaveBeenCalled();
    });

    it('should return the stored response when the request is already completed', async () => {
      const storedResponse = {
        id: 'task-123',
        title: 'Stored task',
      };

      idempotencyService.reserve.mockImplementation(
        async (_scope, _key, currentFingerprint) => ({
          acquired: false,
          record: {
            fingerprint: currentFingerprint,
            status: 'COMPLETED',
            statusCode: 201,
            responseBody: storedResponse,
          },
        }),
      );

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).resolves.toEqual(storedResponse);

      expect(response.status).toHaveBeenCalledWith(201);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('should return the stored response without changing status when statusCode is undefined', async () => {
      const storedResponse = {
        id: 'task-123',
      };

      idempotencyService.reserve.mockImplementation(
        async (_scope, _key, currentFingerprint) => ({
          acquired: false,
          record: {
            fingerprint: currentFingerprint,
            status: 'COMPLETED',
            responseBody: storedResponse,
          },
        }),
      );

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).resolves.toEqual(storedResponse);

      expect(response.status).not.toHaveBeenCalled();
      expect(next.handle).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      request.header.mockReturnValue('key-123');

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      idempotencyService.delete.mockResolvedValue(undefined);
    });

    it('should delete the idempotency record when the handler fails', async () => {
      const error = new Error('Task creation failed');

      next.handle = jest.fn().mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow('Task creation failed');

      expect(idempotencyService.delete).toHaveBeenCalledTimes(1);

      expect(idempotencyService.delete).toHaveBeenCalledWith(
        'user-123:POST:/api/v1/tasks',
        'key-123',
      );
    });

    it('should not complete the record when the handler fails', async () => {
      next.handle = jest
        .fn()
        .mockReturnValue(throwError(() => new Error('Failure')));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow('Failure');

      expect(idempotencyService.complete).not.toHaveBeenCalled();
    });

    it('should rethrow the original handler error', async () => {
      const error = new ConflictException('Original error');

      next.handle = jest.fn().mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBe(error);
    });
  });

  describe('scope and fingerprint', () => {
    it('should use anonymous when user is missing', async () => {
      request.user = undefined;
      request.header.mockReturnValue('key-123');

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(idempotencyService.reserve).toHaveBeenCalledWith(
        'anonymous:POST:/api/v1/tasks',
        'key-123',
        expect.any(String),
      );
    });

    it('should use anonymous when userId is missing', async () => {
      request.user = {};

      request.header.mockReturnValue('key-123');

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(idempotencyService.reserve).toHaveBeenCalledWith(
        'anonymous:POST:/api/v1/tasks',
        'key-123',
        expect.any(String),
      );
    });

    it('should use request URL when baseUrl is empty', async () => {
      request.baseUrl = '';
      request.url = '/api/v1/tasks';

      request.header.mockReturnValue('key-123');

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      expect(idempotencyService.reserve).toHaveBeenCalledWith(
        'user-123:POST:/api/v1/tasks',
        'key-123',
        expect.any(String),
      );
    });

    it('should exclude query parameters from the fingerprint path', async () => {
      request.originalUrl = '/api/v1/tasks?foo=bar';
      request.path = '/api/v1/tasks';

      request.header.mockReturnValue('key-123');

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      const fingerprint = idempotencyService.reserve.mock.calls[0][2];

      expect(fingerprint).toEqual(expect.any(String));
      expect(fingerprint).toHaveLength(64);
    });

    it('should create a SHA-256 fingerprint', async () => {
      request.header.mockReturnValue('key-123');

      idempotencyService.reserve.mockResolvedValue({
        acquired: true,
        record: undefined,
      });

      next.handle = jest.fn().mockReturnValue(of({ success: true }));

      await firstValueFrom(interceptor.intercept(context, next));

      const fingerprint = idempotencyService.reserve.mock.calls[0][2];

      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
