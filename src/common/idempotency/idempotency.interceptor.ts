import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, from, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { createHash } from 'crypto';
import { IDEMPOTENCY_HEADER } from './idempotency.constants';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const idempotencyKey = request.header(IDEMPOTENCY_HEADER);

    if (idempotencyKey === undefined || idempotencyKey === null) {
      return throwError(
        () =>
          new ConflictException(
            `The ${IDEMPOTENCY_HEADER} header is required.`,
          ),
      );
    }

    if (idempotencyKey.trim().length === 0) {
      return throwError(
        () => new ConflictException(`${IDEMPOTENCY_HEADER} must not be empty.`),
      );
    }

    if (idempotencyKey.length > 255) {
      return throwError(
        () =>
          new ConflictException(
            `${IDEMPOTENCY_HEADER} must not exceed 255 characters.`,
          ),
      );
    }

    const scope = this.buildScope(request);
    const fingerprint = this.buildFingerprint(request);

    return from(
      this.idempotencyService.reserve(scope, idempotencyKey, fingerprint),
    ).pipe(
      mergeMap(({ acquired, record }) => {
        if (!acquired && record) {
          if (record.fingerprint !== fingerprint) {
            return throwError(
              () =>
                new ConflictException(
                  'The Idempotency-Key has already been used with a different request.',
                ),
            );
          }

          if (record.status === 'PROCESSING') {
            return throwError(
              () =>
                new ConflictException(
                  'A request with this Idempotency-Key is already being processed.',
                ),
            );
          }

          if (record.status === 'COMPLETED') {
            if (record.statusCode !== undefined) {
              response.status(record.statusCode);
            }

            return from([record.responseBody]);
          }
        }

        return next.handle().pipe(
          mergeMap(async (result) => {
            await this.idempotencyService.complete(scope, idempotencyKey, {
              status: 'COMPLETED',
              fingerprint,
              statusCode: response.statusCode,
              responseBody: result,
            });

            return result;
          }),
          catchError((error) =>
            from(this.idempotencyService.delete(scope, idempotencyKey)).pipe(
              mergeMap(() => throwError(() => error)),
            ),
          ),
        );
      }),
    );
  }

  private buildScope(request: Request): string {
    const userId =
      (request as Request & { user?: { userId?: string } }).user?.userId ??
      'anonymous';

    return `${userId}:${request.method}:${request.baseUrl || request.url}`;
  }

  private buildFingerprint(request: Request): string {
    const userId =
      (request as Request & { user?: { userId?: string } }).user?.userId ??
      'anonymous';

    const payload = JSON.stringify({
      userId,
      method: request.method,
      path: request.originalUrl?.split('?')[0] ?? request.path,
      body: request.body ?? {},
    });

    return createHash('sha256').update(payload).digest('hex');
  }
}
