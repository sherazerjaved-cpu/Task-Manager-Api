import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProblemResponses } from 'src/common/http/problem-responses.decorator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@ProblemResponses()
@SkipThrottle()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness check',
    description:
      'Checks whether the application process is alive and able to respond to requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive.',
  })
  checkLiveness() {
    return this.health.check([
      async () => ({
        application: {
          status: 'up',
        },
      }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness check',
    description:
      'Checks whether the application is ready to receive traffic by verifying MongoDB and Redis connectivity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready.',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready.',
  })
  checkReadiness() {
    return this.health.check([
      async () => this.mongoose.pingCheck('mongodb'),
      async () => this.redis.isHealthy('redis'),
    ]);
  }
}
