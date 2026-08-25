import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ProblemDetailsDto } from './problem-details.dto';

export function ProblemResponses() {
  return applyDecorators(
    ApiExtraModels(ProblemDetailsDto),

    ApiResponse({
      status: 400,
      description: 'Bad Request',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: 'Validation failed',
            instance: '/api/v1/tasks',
            errors: [
              'email must be an email',
              'password must be longer than or equal to 8 characters',
            ],
          },
        },
      },
    }),

    ApiResponse({
      status: 401,
      description: 'Unauthorized',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            detail: 'Unauthorized',
            instance: '/api/v1/tasks',
          },
        },
      },
    }),

    ApiResponse({
      status: 403,
      description: 'Forbidden',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Forbidden',
            status: 403,
            detail: 'You are not allowed to perform this action',
            instance: '/api/v1/tasks',
          },
        },
      },
    }),

    ApiResponse({
      status: 404,
      description: 'Not Found',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: 'Resource not found',
            instance: '/api/v1/tasks/...',
          },
        },
      },
    }),

    ApiResponse({
      status: 409,
      description: 'Conflict',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Conflict',
            status: 409,
            detail:
              'The request conflicts with the current state of the resource',
            instance: '/api/v1/tasks',
          },
        },
      },
    }),

    ApiResponse({
      status: 412,
      description: 'Precondition Failed',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Precondition Failed',
            status: 412,
            detail: 'Task has been modified. Please refresh and try again.',
            instance: '/api/v1/tasks/...',
          },
        },
      },
    }),

    ApiResponse({
      status: 428,
      description: 'Precondition Required',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Precondition Required',
            status: 428,
            detail: 'If-Match header is required',
            instance: '/api/v1/tasks/...',
          },
        },
      },
    }),

    ApiResponse({
      status: 429,
      description: 'Too Many Requests',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Too Many Requests',
            status: 429,
            detail: 'Too many requests',
            instance: '/api/v1/tasks',
          },
        },
      },
    }),

    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      content: {
        'application/problem+json': {
          schema: {
            $ref: getSchemaPath(ProblemDetailsDto),
          },
          example: {
            type: 'about:blank',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Internal server error',
            instance: '/api/v1/tasks',
          },
        },
      },
    }),
  );
}
