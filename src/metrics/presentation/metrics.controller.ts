import { Controller, Get, Res } from '@nestjs/common';
import {
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from '../application/metrics.service';

@ApiTags('Metrics')
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description:
      'Returns application and infrastructure metrics in Prometheus exposition format, including HTTP request metrics and BullMQ queue metrics.',
  })
  @ApiProduces('text/plain')
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics retrieved successfully.',
    content: {
      'text/plain': {
        example:
          '# HELP http_requests_total Total number of HTTP requests\n' +
          '# TYPE http_requests_total counter\n' +
          'http_requests_total{method="GET",route="/api/v1/users",status_code="200"} 5',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to generate Prometheus metrics.',
  })
  async getMetrics(@Res() response: Response): Promise<void> {
    response
      .setHeader('Content-Type', this.metricsService.getContentType())
      .send(await this.metricsService.getMetrics());
  }
}
