import { Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProblemResponses } from './problem-responses.decorator';
import { ProblemDetailsDto } from './problem-details.dto';

describe('ProblemResponses', () => {
  const createTestController = () => {
    class TestController {
      @Get()
      @ProblemResponses()
      test() {
        return {};
      }
    }

    return TestController;
  };

  const getResponses = () => {
    const TestController = createTestController();
    const reflector = new Reflector();

    return reflector.get(
      'swagger/apiResponse',
      TestController.prototype.test,
    ) as Record<
      string,
      {
        status?: number;
        description?: string;
        content?: Record<
          string,
          {
            schema?: {
              $ref?: string;
            };
            example?: Record<string, unknown>;
          }
        >;
      }
    >;
  };

  it('should return a decorator function', () => {
    const decorator = ProblemResponses();

    expect(typeof decorator).toBe('function');
  });

  it('should apply Swagger metadata to a controller method', () => {
    const responses = getResponses();

    expect(responses).toBeDefined();
    expect(typeof responses).toBe('object');
  });

  it('should register all expected HTTP responses', () => {
    const responses = getResponses();

    const statuses = Object.keys(responses).map(Number);

    expect(statuses).toEqual(
      expect.arrayContaining([400, 401, 403, 404, 409, 412, 428, 429, 500]),
    );
  });

  it('should register exactly nine problem responses', () => {
    const responses = getResponses();

    expect(Object.keys(responses)).toHaveLength(9);
  });

  it('should use application/problem+json for every response', () => {
    const responses = getResponses();

    for (const response of Object.values(responses)) {
      expect(response.content).toBeDefined();

      expect(response.content).toHaveProperty('application/problem+json');
    }
  });

  it('should reference ProblemDetailsDto in every response schema', () => {
    const responses = getResponses();

    for (const response of Object.values(responses)) {
      const schema = response.content?.['application/problem+json']?.schema;

      expect(schema).toBeDefined();
      expect(schema?.$ref).toContain('ProblemDetailsDto');
    }
  });

  it('should register the expected descriptions', () => {
    const responses = getResponses();

    expect(responses['400'].description).toBe('Bad Request');
    expect(responses['401'].description).toBe('Unauthorized');
    expect(responses['403'].description).toBe('Forbidden');
    expect(responses['404'].description).toBe('Not Found');
    expect(responses['409'].description).toBe('Conflict');
    expect(responses['412'].description).toBe('Precondition Failed');
    expect(responses['428'].description).toBe('Precondition Required');
    expect(responses['429'].description).toBe('Too Many Requests');
    expect(responses['500'].description).toBe('Internal Server Error');
  });

  it('should register the expected response examples', () => {
    const responses = getResponses();

    expect(
      responses['400'].content?.['application/problem+json']?.example,
    ).toEqual(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Validation failed',
      }),
    );

    expect(
      responses['401'].content?.['application/problem+json']?.example,
    ).toEqual(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
      }),
    );

    expect(
      responses['428'].content?.['application/problem+json']?.example,
    ).toEqual(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Precondition Required',
        status: 428,
        detail: 'If-Match header is required',
      }),
    );

    expect(
      responses['429'].content?.['application/problem+json']?.example,
    ).toEqual(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
      }),
    );

    expect(
      responses['500'].content?.['application/problem+json']?.example,
    ).toEqual(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      }),
    );
  });

  it('should register ProblemDetailsDto as the Swagger model', () => {
    expect(ProblemDetailsDto).toBeDefined();
  });
});
