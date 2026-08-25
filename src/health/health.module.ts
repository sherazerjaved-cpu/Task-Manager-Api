import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
