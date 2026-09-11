import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class DeadLetterService {
  constructor(
    @InjectQueue(QUEUE_NAMES.DLQ)
    private readonly deadLetterQueue: Queue,
  ) {}

  async moveToDeadLetterQueue(data: {
    queueName: string;
    jobId?: string;
    outboxEventId?: string;
    eventType?: string;
    payload?: Record<string, unknown>;
    error: string;
    attempts: number;
    correlationId?: string;
  }): Promise<void> {
    await this.deadLetterQueue.add(
      'dead-letter-job',
      {
        ...data,
        failedAt: new Date().toISOString(),
      },
      {
        jobId: data.jobId ? `dlq-${data.jobId}` : undefined,
      },
    );
  }
}
