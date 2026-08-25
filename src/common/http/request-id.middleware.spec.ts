import { RequestIdMiddleware } from './request-id.middleware';
import { RequestContextService } from './request-context.service';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let requestContextService: {
    run: jest.Mock;
  };

  let request: {
    headers: Record<string, string | string[] | undefined>;
  };

  let response: {
    setHeader: jest.Mock;
  };

  let next: jest.Mock;

  beforeEach(() => {
    requestContextService = {
      run: jest.fn((context, callback) => callback()),
    };

    middleware = new RequestIdMiddleware(
      requestContextService as unknown as RequestContextService,
    );

    request = {
      headers: {},
    };

    response = {
      setHeader: jest.fn(),
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('use', () => {
    it('should use the existing X-Request-Id header when provided', () => {
      request.headers['x-request-id'] = 'existing-request-id';

      middleware.use(request as any, response as any, next);

      expect(request.headers['x-request-id']).toBe('existing-request-id');

      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        'existing-request-id',
      );
    });

    it('should generate a request ID when X-Request-Id is missing', () => {
      middleware.use(request as any, response as any, next);

      expect(request.headers['x-request-id']).toBeDefined();
      expect(typeof request.headers['x-request-id']).toBe('string');
      expect(
        (request.headers['x-request-id'] as string).length,
      ).toBeGreaterThan(0);
    });

    it('should set the X-Request-Id response header', () => {
      request.headers['x-request-id'] = 'request-123';

      middleware.use(request as any, response as any, next);

      expect(response.setHeader).toHaveBeenCalledTimes(1);
      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        'request-123',
      );
    });

    it('should store the request ID in RequestContextService', () => {
      request.headers['x-request-id'] = 'request-123';

      middleware.use(request as any, response as any, next);

      expect(requestContextService.run).toHaveBeenCalledWith(
        {
          requestId: 'request-123',
        },
        expect.any(Function),
      );
    });

    it('should call next inside the request context', () => {
      request.headers['x-request-id'] = 'request-123';

      middleware.use(request as any, response as any, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should use the generated request ID in the request context', () => {
      middleware.use(request as any, response as any, next);

      const [context] = requestContextService.run.mock.calls[0];

      expect(context.requestId).toBe(request.headers['x-request-id']);
    });

    it('should use the generated request ID in the response header', () => {
      middleware.use(request as any, response as any, next);

      const generatedRequestId = request.headers['x-request-id'];

      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        generatedRequestId,
      );
    });

    it('should overwrite a non-string X-Request-Id header with a generated ID', () => {
      request.headers['x-request-id'] = ['invalid-request-id'];

      middleware.use(request as any, response as any, next);

      expect(typeof request.headers['x-request-id']).toBe('string');

      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        request.headers['x-request-id'],
      );
    });

    it('should preserve the same request ID between request, response, and context', () => {
      request.headers['x-request-id'] = 'request-123';

      middleware.use(request as any, response as any, next);

      const [context] = requestContextService.run.mock.calls[0];

      expect(request.headers['x-request-id']).toBe('request-123');
      expect(context.requestId).toBe('request-123');

      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        'request-123',
      );
    });
  });
});
