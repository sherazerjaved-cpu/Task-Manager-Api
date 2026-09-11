import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';

import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from '../application/metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;

  let metricsService: {
    httpRequestsTotal: {
      inc: jest.Mock;
    };
    httpRequestDuration: {
      observe: jest.Mock;
    };
  };

  let context: {
    switchToHttp: jest.Mock;
  };

  let request: {
    path: string;
    route?: {
      path: string;
    };
    method: string;
  };

  let response: {
    statusCode: number;
  };

  let next: {
    handle: jest.Mock;
  };

  beforeEach(() => {
    metricsService = {
      httpRequestsTotal: {
        inc: jest.fn(),
      },
      httpRequestDuration: {
        observe: jest.fn(),
      },
    };

    interceptor = new MetricsInterceptor(
      metricsService as unknown as MetricsService,
    );

    request = {
      path: '/api/v1/tasks',
      route: {
        path: '/api/v1/tasks',
      },
      method: 'GET',
    };

    response = {
      statusCode: 200,
    };

    next = {
      handle: jest.fn().mockReturnValue(of({})),
    };

    context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn().mockReturnValue(response),
      }),
    };
  });

  describe('intercept', () => {
    it('should call the next handler for a normal request', () => {
      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it('should record HTTP request metrics after the request completes', () => {
      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledTimes(1);

      expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should use the request method as a metric label', () => {
      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should use the route path when available', () => {
      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      const expectedLabels = {
        method: 'GET',
        route: '/api/v1/tasks',
        status_code: '200',
      };

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
        expectedLabels,
      );

      expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
        expectedLabels,
        expect.any(Number),
      );
    });

    it('should fall back to request.path when route is unavailable', () => {
      request.route = undefined;

      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/v1/tasks',
        status_code: '200',
      });
    });

    it('should use the response status code as a metric label', () => {
      response.statusCode = 201;

      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/v1/tasks',
        status_code: '201',
      });
    });

    it('should record the request duration in seconds', () => {
      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      const [, duration] =
        metricsService.httpRequestDuration.observe.mock.calls[0];

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should record duration using the same labels as the counter', () => {
      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      const counterLabels =
        metricsService.httpRequestsTotal.inc.mock.calls[0][0];

      const histogramLabels =
        metricsService.httpRequestDuration.observe.mock.calls[0][0];

      expect(histogramLabels).toEqual(counterLabels);
    });

    it('should not record metrics for the metrics endpoint', () => {
      request.path = '/metrics';

      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      expect(next.handle).toHaveBeenCalledTimes(1);

      expect(metricsService.httpRequestsTotal.inc).not.toHaveBeenCalled();

      expect(metricsService.httpRequestDuration.observe).not.toHaveBeenCalled();
    });

    it('should not record metrics for nested metrics paths', () => {
      request.path = '/api/v1/metrics';

      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe();

      expect(metricsService.httpRequestsTotal.inc).not.toHaveBeenCalled();

      expect(metricsService.httpRequestDuration.observe).not.toHaveBeenCalled();
    });

    it('should record metrics when the request handler errors', () => {
      next.handle.mockReturnValue(
        throwError(() => new Error('Request failed')),
      );

      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe({
        error: () => undefined,
      });

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledTimes(1);

      expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should record the error response status code', () => {
      response.statusCode = 500;

      next.handle.mockReturnValue(
        throwError(() => new Error('Request failed')),
      );

      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      result.subscribe({
        error: () => undefined,
      });

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/v1/tasks',
        status_code: '500',
      });
    });

    it('should not subscribe to the handler itself', () => {
      const observable = of('response');

      next.handle.mockReturnValue(observable);

      const result = interceptor.intercept(
        context as unknown as ExecutionContext,
        next as unknown as CallHandler,
      );

      expect(metricsService.httpRequestsTotal.inc).not.toHaveBeenCalled();

      expect(metricsService.httpRequestDuration.observe).not.toHaveBeenCalled();

      result.subscribe();

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledTimes(1);
    });
  });
});
