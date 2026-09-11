import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from '../application/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();

    const request = http.getRequest<Request>();
    if (request.path.endsWith('/metrics')) {
      return next.handle();
    }

    const response = http.getResponse<Response>();

    const start = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const durationNanoseconds = process.hrtime.bigint() - start;

        const durationSeconds = Number(durationNanoseconds) / 1_000_000_000;

        const route = request.route?.path ?? request.path;

        const labels = {
          method: request.method,
          route,
          status_code: String(response.statusCode),
        };

        this.metricsService.httpRequestsTotal.inc(labels);

        this.metricsService.httpRequestDuration.observe(
          labels,
          durationSeconds,
        );
      }),
    );
  }
}
