import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import { UserRateLimitInterceptor } from './user-rate-limit.interceptor';
import { UserRateLimitService } from '../services/user-rate-limit.service';

describe('UserRateLimitInterceptor', () => {
  let interceptor: UserRateLimitInterceptor;
  let userRateLimitService: {
    checkLimit: jest.Mock;
  };
  let checkLimitMock: jest.Mock;
  let handleMock: jest.Mock;

  let next: CallHandler;

  const createContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    checkLimitMock = jest.fn();
    handleMock = jest.fn().mockReturnValue(of({ success: true }));

    userRateLimitService = {
      checkLimit: checkLimitMock,
    };

    interceptor = new UserRateLimitInterceptor(
      userRateLimitService as unknown as UserRateLimitService,
    );

    next = {
      handle: handleMock,
    };
  });

  describe('unauthenticated requests', () => {
    it('should allow the request when there is no user', async () => {
      const context = createContext(undefined);

      const result = await interceptor.intercept(context, next);

      expect(handleMock).toHaveBeenCalledTimes(1);
      expect(checkLimitMock).not.toHaveBeenCalled();

      await expect(lastValueFrom(result)).resolves.toEqual({
        success: true,
      });
    });

    it('should allow the request when user exists but has no userId or sub', async () => {
      const context = createContext({
        email: 'user@example.com',
        role: 'user',
      });

      const result = await interceptor.intercept(context, next);

      expect(handleMock).toHaveBeenCalledTimes(1);
      expect(checkLimitMock).not.toHaveBeenCalled();

      await expect(lastValueFrom(result)).resolves.toEqual({
        success: true,
      });
    });

    it('should allow the request when userId is an empty string and sub is absent', async () => {
      const context = createContext({
        userId: '',
      });

      const result = await interceptor.intercept(context, next);

      expect(handleMock).toHaveBeenCalledTimes(1);
      expect(checkLimitMock).not.toHaveBeenCalled();

      await expect(lastValueFrom(result)).resolves.toEqual({
        success: true,
      });
    });
  });

  describe('authenticated requests', () => {
    it('should check the rate limit using userId', async () => {
      checkLimitMock.mockResolvedValue(true);

      const context = createContext({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'user',
      });

      const result = await interceptor.intercept(context, next);

      expect(checkLimitMock).toHaveBeenCalledTimes(1);
      expect(checkLimitMock).toHaveBeenCalledWith('user-123');
      expect(handleMock).toHaveBeenCalledTimes(1);

      await expect(lastValueFrom(result)).resolves.toEqual({
        success: true,
      });
    });

    it('should use sub when userId is not available', async () => {
      checkLimitMock.mockResolvedValue(true);

      const context = createContext({
        sub: 'user-456',
        email: 'user@example.com',
        role: 'user',
      });

      const result = await interceptor.intercept(context, next);

      expect(checkLimitMock).toHaveBeenCalledTimes(1);
      expect(checkLimitMock).toHaveBeenCalledWith('user-456');
      expect(handleMock).toHaveBeenCalledTimes(1);

      await expect(lastValueFrom(result)).resolves.toEqual({
        success: true,
      });
    });

    it('should prefer userId over sub when both are present', async () => {
      checkLimitMock.mockResolvedValue(true);

      const context = createContext({
        userId: 'user-123',
        sub: 'user-456',
      });

      const result = await interceptor.intercept(context, next);

      expect(checkLimitMock).toHaveBeenCalledWith('user-123');
      expect(handleMock).toHaveBeenCalledTimes(1);

      await expect(lastValueFrom(result)).resolves.toEqual({
        success: true,
      });
    });

    it('should allow the request when the rate limit service allows it', async () => {
      checkLimitMock.mockResolvedValue(true);

      const context = createContext({
        userId: 'user-123',
      });

      const result = await interceptor.intercept(context, next);

      expect(checkLimitMock).toHaveBeenCalledWith('user-123');
      expect(handleMock).toHaveBeenCalledTimes(1);

      await expect(lastValueFrom(result)).resolves.toEqual({
        success: true,
      });
    });

    it('should reject the request when the rate limit is exceeded', async () => {
      checkLimitMock.mockResolvedValue(false);

      const context = createContext({
        userId: 'user-123',
      });

      await expect(interceptor.intercept(context, next)).rejects.toThrow(
        HttpException,
      );

      expect(checkLimitMock).toHaveBeenCalledWith('user-123');
      expect(handleMock).not.toHaveBeenCalled();
    });

    it('should return HTTP 429 when the rate limit is exceeded', async () => {
      checkLimitMock.mockResolvedValue(false);

      const context = createContext({
        userId: 'user-123',
      });

      try {
        await interceptor.intercept(context, next);
        fail('Expected interceptor to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);

        const exception = error as HttpException;

        expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

        expect(exception.getResponse()).toBe(
          'Too many requests. Please try again later.',
        );
      }

      expect(handleMock).not.toHaveBeenCalled();
    });

    it('should propagate an error from the rate limit service', async () => {
      checkLimitMock.mockRejectedValue(new Error('Redis connection failed'));

      const context = createContext({
        userId: 'user-123',
      });

      await expect(interceptor.intercept(context, next)).rejects.toThrow(
        'Redis connection failed',
      );

      expect(handleMock).not.toHaveBeenCalled();
    });
  });
});
