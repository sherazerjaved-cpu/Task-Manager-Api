import { INestApplication } from '@nestjs/common';
import { Connection } from 'mongoose';
import { EmailProcessor } from 'src/infrastructure/processors/email.processor';
import { WebhookProcessor } from 'src/infrastructure/processors/webhook.processor';
import { ReminderProcessor } from 'src/infrastructure/processors/reminder.processor';
import { ExportProcessor } from 'src/infrastructure/processors/export.processor';
import { DeadLetterProcessor } from 'src/infrastructure/processors/dead-letter.processor';
import { closeDatabase } from 'test/integration/setup/database';
import { closeRedis } from 'test/integration/setup/redis';

export async function shutdownIntegrationApp(
  app: INestApplication | undefined,
  mongoConnection: Connection | undefined,
): Promise<void> {
  if (app) {
    const processors = [
      app.get(EmailProcessor),
      app.get(WebhookProcessor),
      app.get(ExportProcessor),
      app.get(DeadLetterProcessor),
      app.get(ReminderProcessor),
    ];

    for (const processor of processors) {
      const worker = processor.getWorker();

      if (worker) {
        await worker.close();
      }
    }

    await app.close();
  }

  await closeRedis();

  if (mongoConnection) {
    await closeDatabase(mongoConnection);
  }
}
