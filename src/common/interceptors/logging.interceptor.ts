import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  private sanitizeUrl(url: string): string {
    try {
      if (!url || url.includes('://')) {
        const parsedUrl = new URL(url);

        return parsedUrl.pathname;
      }

      const parsedUrl = new URL(url, 'http://localhost');

      if (!parsedUrl.pathname.startsWith('/')) {
        return '[REDACTED_URL]';
      }

      return parsedUrl.pathname;
    } catch {
      return '[REDACTED_URL]';
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method;
    const url = this.sanitizeUrl(request.originalUrl ?? request.url);

    const requestId =
      typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : 'unknown';

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;

        this.logger.info(
          {
            requestId,
            method,
            url,
            statusCode: response.statusCode,
            durationMs,
          },
          'HTTP request completed',
        );
      }),

      catchError((error: unknown) => {
        const durationMs = Date.now() - startTime;

        this.logger.error(
          {
            requestId,
            method,
            url,
            statusCode: response.statusCode,
            durationMs,
            err: error instanceof Error ? error : undefined,
          },
          'HTTP request failed',
        );

        return throwError(() => error);
      }),
    );
  }
}
