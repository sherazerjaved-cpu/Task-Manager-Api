import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { EmailProcessor } from '../queues/../processors/email.processor';
import { ReminderProcessor } from '../queues/../processors/reminder.processor';
import { WebhookProcessor } from '../queues/../processors/webhook.processor';
import { ExportProcessor } from '../queues/../processors/export.processor';
import { DeadLetterProcessor } from '../queues/../processors/dead-letter.processor';

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);

  constructor(
    @InjectConnection()
    private readonly mongoConnection: Connection,

    private readonly emailProcessor: EmailProcessor,
    private readonly reminderProcessor: ReminderProcessor,
    private readonly webhookProcessor: WebhookProcessor,
    private readonly exportProcessor: ExportProcessor,
    private readonly deadLetterProcessor: DeadLetterProcessor,
  ) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Graceful shutdown started${signal ? ` (${signal})` : ''}`);

    await this.closeWorkers();
    await this.closeMongo();

    this.logger.log('Graceful shutdown completed');
  }

  private async closeWorkers(): Promise<void> {
    const workers = [
      {
        name: 'email',
        worker: this.emailProcessor.getWorker(),
      },
      {
        name: 'reminder',
        worker: this.reminderProcessor.getWorker(),
      },
      {
        name: 'webhook',
        worker: this.webhookProcessor.getWorker(),
      },
      {
        name: 'export',
        worker: this.exportProcessor.getWorker(),
      },
      {
        name: 'dead-letter',
        worker: this.deadLetterProcessor.getWorker(),
      },
    ];

    for (const { name, worker } of workers) {
      try {
        this.logger.log(`Draining ${name} queue worker...`);

        await worker.close();

        this.logger.log(`${name} queue worker closed`);
      } catch (error) {
        this.logger.error(
          `Failed to close ${name} queue worker`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async closeMongo(): Promise<void> {
    try {
      if (this.mongoConnection.readyState) {
        await this.mongoConnection.close();

        this.logger.log('MongoDB connection closed');
      }
    } catch (error) {
      this.logger.error(
        'Failed to close MongoDB connection',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
