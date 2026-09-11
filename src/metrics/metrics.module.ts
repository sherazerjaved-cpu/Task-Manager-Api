import { Global, Module } from '@nestjs/common';
import { MetricsService } from './application/metrics.service';
import { MetricsController } from './presentation/metrics.controller';
import { MetricsInterceptor } from './presentation/metrics.interceptor';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsInterceptor],
  exports: [MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
