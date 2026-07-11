import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Check application health',
    description:
      'Returns the health status of the application and MongoDB connection.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy.',
  })
  @ApiResponse({
    status: 503,
    description: 'One or more health checks failed.',
  })
  check() {
    return this.health.check([async () => this.mongoose.pingCheck('mongodb')]);
  }
}
