import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { QUEUE_NAMES } from '../queues/queue.constants';

@Processor(QUEUE_NAMES.DLQ)
export class DeadLetterProcessor extends WorkerHost {
  getWorker() {
    return this.worker;
  }

  constructor(private readonly logger: PinoLogger) {
    super();

    this.logger.setContext(DeadLetterProcessor.name);
  }

  async process(job: Job): Promise<void> {
    const {
      queueName,
      outboxEventId,
      eventType,
      payload,
      error,
      attempts,
      failedAt,
      correlationId,
    } = job.data;

    this.logger.error(
      {
        jobId: job.id,
        queue: QUEUE_NAMES.DLQ,
        sourceQueue: queueName,
        correlationId,
        outboxEventId,
        eventType,
        attempts,
        failedAt,
      },
      'Dead-letter job received',
    );

    this.logger.error(
      {
        jobId: job.id,
        queue: QUEUE_NAMES.DLQ,
        sourceQueue: queueName,
        correlationId,
        outboxEventId,
        eventType,
        attempts,
        failedAt,
        error,
      },
      'Dead-letter job details',
    );

    this.logger.warn(
      {
        jobId: job.id,
        queue: QUEUE_NAMES.DLQ,
        correlationId,
        payload,
      },
      'Dead-letter job payload',
    );
  }
}
