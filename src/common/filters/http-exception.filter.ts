import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId?: string;
  errors?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : undefined;

    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let title =
      status === Number(HttpStatus.INTERNAL_SERVER_ERROR)
        ? 'Internal Server Error'
        : (HttpStatus[status] ?? 'Error');

    if (status === Number(HttpStatus.PRECONDITION_REQUIRED)) {
      title = 'Precondition Required';
    }

    if (status === Number(HttpStatus.TOO_MANY_REQUESTS)) {
      title = 'Too Many Requests';
    }

    let detail = 'Internal server error';
    let errors: unknown;

    if (isHttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        detail = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const errorResponse = exceptionResponse as Record<string, unknown>;

        if (typeof errorResponse.error === 'string') {
          title = errorResponse.error;
        }

        if (Array.isArray(errorResponse.message)) {
          detail = 'Validation failed';
          errors = errorResponse.message;
        } else if (typeof errorResponse.message === 'string') {
          detail = errorResponse.message;
        }
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} - ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const problem: ProblemDetails = {
      type: this.getProblemType(status),
      title,
      status,
      detail,
      instance: request.originalUrl,
    };

    if (requestId) {
      problem.requestId = requestId;
    }

    if (errors) {
      problem.errors = errors;
    }

    response.status(status).type('application/problem+json').json(problem);
  }

  private getProblemType(status: number): string {
    switch (status) {
      case Number(HttpStatus.BAD_REQUEST):
        return 'https://api.taskmanager.local/problems/bad-request';

      case Number(HttpStatus.UNAUTHORIZED):
        return 'https://api.taskmanager.local/problems/unauthorized';

      case Number(HttpStatus.FORBIDDEN):
        return 'https://api.taskmanager.local/problems/forbidden';

      case Number(HttpStatus.NOT_FOUND):
        return 'https://api.taskmanager.local/problems/not-found';

      case Number(HttpStatus.CONFLICT):
        return 'https://api.taskmanager.local/problems/conflict';

      case Number(HttpStatus.PRECONDITION_FAILED):
        return 'https://api.taskmanager.local/problems/precondition-failed';

      case Number(HttpStatus.PRECONDITION_REQUIRED):
        return 'https://api.taskmanager.local/problems/precondition-required';

      case Number(HttpStatus.TOO_MANY_REQUESTS):
        return 'https://api.taskmanager.local/problems/rate-limit';

      default:
        if (status >= 500) {
          return 'https://api.taskmanager.local/problems/internal-server-error';
        }

        return 'https://api.taskmanager.local/problems/error';
    }
  }
}
