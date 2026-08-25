import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PreconditionFailedException,
  UnauthorizedException,
} from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  let response: {
    status: jest.Mock;
    type: jest.Mock;
    json: jest.Mock;
  };

  let request: {
    method: string;
    originalUrl: string;
    headers: Record<string, string | string[] | undefined>;
  };

  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    response = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    request = {
      method: 'GET',
      originalUrl: '/api/v1/categories',
      headers: {},
    };

    host = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(response),
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP exceptions', () => {
    it('should return a bad request problem response', () => {
      const exception = new BadRequestException('Invalid request');

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

      expect(response.type).toHaveBeenCalledWith('application/problem+json');

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid request',
        instance: '/api/v1/categories',
      });
    });

    it('should return an unauthorized problem response', () => {
      const exception = new UnauthorizedException('Authentication required');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
        instance: '/api/v1/categories',
      });
    });

    it('should return a forbidden problem response', () => {
      const exception = new ForbiddenException('Access denied');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Access denied',
        instance: '/api/v1/categories',
      });
    });

    it('should return a not found problem response', () => {
      const exception = new NotFoundException('Category not found');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Category not found',
        instance: '/api/v1/categories',
      });
    });

    it('should return a conflict problem response', () => {
      const exception = new ConflictException('Resource conflict');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/conflict',
        title: 'Conflict',
        status: 409,
        detail: 'Resource conflict',
        instance: '/api/v1/categories',
      });
    });

    it('should return a precondition failed problem response', () => {
      const exception = new PreconditionFailedException('ETag does not match');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/precondition-failed',
        title: 'Precondition Failed',
        status: 412,
        detail: 'ETag does not match',
        instance: '/api/v1/categories',
      });
    });

    it('should return a precondition required problem response', () => {
      const exception = new HttpException(
        'If-Match header is required',
        HttpStatus.PRECONDITION_REQUIRED,
      );

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/precondition-required',
        title: 'Precondition Required',
        status: 428,
        detail: 'If-Match header is required',
        instance: '/api/v1/categories',
      });
    });

    it('should return a rate limit problem response', () => {
      const exception = new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/rate-limit',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many requests',
        instance: '/api/v1/categories',
      });
    });
  });

  describe('validation errors', () => {
    it('should return validation errors as an errors array', () => {
      const exception = new BadRequestException({
        message: ['name must be a string', 'color must be a string'],
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Validation failed',
        instance: '/api/v1/categories',
        errors: ['name must be a string', 'color must be a string'],
      });
    });

    it('should use a string message as the detail', () => {
      const exception = new BadRequestException({
        message: 'Invalid category',
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid category',
        instance: '/api/v1/categories',
      });
    });

    it('should use the exception error field as the title', () => {
      const exception = new BadRequestException({
        message: 'Something went wrong',
        error: 'Custom Error',
        statusCode: 400,
      });

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Error',
          detail: 'Something went wrong',
        }),
      );
    });

    it('should use the exception response string as detail', () => {
      const exception = new BadRequestException('Simple error');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'Simple error',
        }),
      );
    });
  });

  describe('request ID', () => {
    it('should include x-request-id when present', () => {
      request.headers['x-request-id'] = 'request-123';

      const exception = new NotFoundException('Not found');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Not found',
        instance: '/api/v1/categories',
        requestId: 'request-123',
      });
    });

    it('should not include requestId when x-request-id is missing', () => {
      const exception = new NotFoundException('Not found');

      filter.catch(exception, host);

      const problem = response.json.mock.calls[0][0];

      expect(problem).not.toHaveProperty('requestId');
    });

    it('should not include requestId when x-request-id is not a string', () => {
      request.headers['x-request-id'] = ['request-123'];

      const exception = new NotFoundException('Not found');

      filter.catch(exception, host);

      const problem = response.json.mock.calls[0][0];

      expect(problem).not.toHaveProperty('requestId');
    });
  });

  describe('unknown exceptions', () => {
    it('should return 500 for an Error', () => {
      const exception = new Error('Database connection failed');

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      expect(response.type).toHaveBeenCalledWith('application/problem+json');

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/internal-server-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Internal server error',
        instance: '/api/v1/categories',
      });
    });

    it('should return 500 for a non-Error exception', () => {
      filter.catch('unexpected failure', host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      expect(response.json).toHaveBeenCalledWith({
        type: 'https://api.taskmanager.local/problems/internal-server-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Internal server error',
        instance: '/api/v1/categories',
      });
    });

    it('should handle null exceptions', () => {
      filter.catch(null, host);

      expect(response.status).toHaveBeenCalledWith(500);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 500,
          title: 'Internal Server Error',
          detail: 'Internal server error',
        }),
      );
    });
  });

  describe('response metadata', () => {
    it('should always use application/problem+json', () => {
      filter.catch(new NotFoundException('Not found'), host);

      expect(response.type).toHaveBeenCalledWith('application/problem+json');
    });

    it('should preserve the request URL in instance', () => {
      request.originalUrl = '/api/v1/workspaces/123/categories';

      filter.catch(new NotFoundException('Not found'), host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          instance: '/api/v1/workspaces/123/categories',
        }),
      );
    });

    it('should use the request method and URL when handling server errors', () => {
      request.method = 'POST';
      request.originalUrl = '/api/v1/categories';

      const exception = new Error('Database failure');

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 500,
          instance: '/api/v1/categories',
        }),
      );
    });
  });
});
