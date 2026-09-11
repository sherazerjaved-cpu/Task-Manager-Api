import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskModule } from './task/task.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReminderModule } from './reminder/reminder.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { TerminusModule } from '@nestjs/terminus';
import { HealthModule } from './health/health.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ActivityModule } from './activity/activity.module';
import { MailModule } from './mail/mail.module';
import KeyvRedis from '@keyv/redis';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { validationSchema } from './config/validation.schema';
import { WorkspaceModule } from './workspace/workspace.module';
import { AuditModule } from './audit/audit.module';
import { QueuesModule } from './infrastructure/queues/queues.module';
import { OutboxModule } from './outbox/outbox.module';
import { WebhookModule } from './webhook/webhook.module';
import { ExportModule } from './export/export.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { LoggerModule } from 'nestjs-pino';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { randomUUID } from 'crypto';
import { CommonHttpModule } from './common/http/common-http.module';
import { MetricsModule } from './metrics/metrics.module';
import { ShutdownModule } from './infrastructure/shutdown/shutdown.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
        autoLogging: false,

        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.accessToken',
            'req.body.refreshToken',
            'req.body.token',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },

        genReqId: (req) => {
          const requestId = req.headers['x-request-id'];

          if (typeof requestId === 'string') {
            return requestId;
          }

          return randomUUID();
        },
      },
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        stores: [
          new KeyvRedis(
            configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
          ),
        ],
        ttl: 60 * 1000,
      }),
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest = configService.get<string>('NODE_ENV') === 'test';
        const isLoadTest = process.env.LOAD_TEST === 'true';

        return {
          throttlers: [
            {
              ttl: 15 * 60 * 1000,
              limit: isTest || isLoadTest ? 1_000_000 : 100,
            },
          ],
          ...(isTest || isLoadTest
            ? {}
            : {
                storage: new ThrottlerStorageRedisService(
                  new Redis(
                    configService.get<string>('REDIS_URL') ??
                      'redis://localhost:6379',
                  ),
                ),
              }),
        };
      },
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        autoIndex: true,
      }),
    }),

    TaskModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ReminderModule,
    TerminusModule,
    HealthModule,
    WebsocketModule,
    ActivityModule,
    MailModule,
    WorkspaceModule,
    AuditModule,
    QueuesModule,
    OutboxModule,
    WebhookModule,
    ExportModule,
    IdempotencyModule,
    CommonHttpModule,
    MetricsModule,
    ShutdownModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
