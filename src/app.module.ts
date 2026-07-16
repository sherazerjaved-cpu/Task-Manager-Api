import { Module } from '@nestjs/common';
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
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { TerminusModule } from '@nestjs/terminus';
import { HealthModule } from './health/health.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ActivityModule } from './activity/activity.module';
import { MailModule } from './mail/mail.module';
import KeyvRedis from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 15 * 60 * 1000,
          limit: 100,
        },
      ],
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
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
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
