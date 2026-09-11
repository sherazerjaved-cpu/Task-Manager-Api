import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';
import { EmailProcessor } from '../processors/email.processor';
import { ReminderProcessor } from '../processors/reminder.processor';
import { WebhookProcessor } from '../processors/webhook.processor';
import { ExportProcessor } from '../processors/export.processor';
import { WebhookModule } from 'src/webhook/webhook.module';
import { ExportModule } from 'src/export/export.module';
import { DeadLetterService } from './dead-letter.service';
import { DeadLetterProcessor } from '../processors/dead-letter.processor';
import { MailModule } from 'src/mail/mail.module';
import { OutboxModule } from 'src/outbox/outbox.module';
import { QueueMetricsService } from './queue-metrics.service';
import { MetricsModule } from 'src/metrics/metrics.module';

@Module({
  imports: [
    WebhookModule,
    ExportModule,
    MailModule,
    MetricsModule,
    forwardRef(() => OutboxModule),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),

    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.EMAIL,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: false,
        },
      },
      {
        name: QUEUE_NAMES.REMINDER,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: false,
        },
      },
      {
        name: QUEUE_NAMES.WEBHOOK,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: false,
        },
      },
      {
        name: QUEUE_NAMES.EXPORT,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: false,
        },
      },
      {
        name: QUEUE_NAMES.DLQ,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: false,
        },
      },
    ),
  ],

  providers: [
    EmailProcessor,
    ReminderProcessor,
    WebhookProcessor,
    ExportProcessor,
    DeadLetterProcessor,
    DeadLetterService,
    QueueMetricsService,
  ],

  exports: [
    BullModule,
    DeadLetterService,
    EmailProcessor,
    ReminderProcessor,
    WebhookProcessor,
    ExportProcessor,
    DeadLetterProcessor,
  ],
})
export class QueuesModule {}
