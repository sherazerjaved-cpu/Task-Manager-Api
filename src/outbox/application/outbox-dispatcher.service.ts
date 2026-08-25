import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';

import { OUTBOX_REPOSITORY } from '../domain/constants/repository.tokens';
import type { IOutboxRepository } from '../domain/repositories/outbox.repository.interface';
import { QUEUE_NAMES } from 'src/infrastructure/queues/queue.constants';

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: IOutboxRepository,

    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emailQueue: Queue,

    @InjectQueue(QUEUE_NAMES.REMINDER)
    private readonly reminderQueue: Queue,

    @InjectQueue(QUEUE_NAMES.WEBHOOK)
    private readonly webhookQueue: Queue,

    @InjectQueue(QUEUE_NAMES.EXPORT)
    private readonly exportQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async dispatchPending(limit = 50): Promise<void> {
    const events = await this.outboxRepository.findPending(limit, new Date());

    for (const event of events) {
      const processing = await this.outboxRepository.markProcessing(
        event._id.toString(),
      );

      if (!processing) {
        continue;
      }

      try {
        const queue = this.getQueue(event.eventType);

        if (!queue) {
          throw new Error(
            `No queue configured for event type: ${event.eventType}`,
          );
        }

        await queue.add(
          event.eventType,
          {
            outboxEventId: event._id.toString(),
            eventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId.toString(),
            workspaceId: event.workspaceId?.toString(),
            correlationId: event.correlationId,
            payload: event.payload,
          },
          {
            jobId: event._id.toString(),
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        );

        await this.outboxRepository.markCompleted(event._id.toString());

        this.logger.log(`Outbox event dispatched: ${event._id.toString()}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        const retryDelay = Math.min(30_000, 1000 * 2 ** event.attempts);

        await this.outboxRepository.markFailed(
          event._id.toString(),
          message,
          new Date(Date.now() + retryDelay),
        );

        this.logger.error(
          `Failed to dispatch outbox event ${event._id.toString()}: ${message}`,
        );
      }
    }
  }

  private getQueue(eventType: string): Queue | null {
    switch (eventType) {
      case 'TASK_CREATED':
      case 'TASK_COMPLETED':
      case 'TASK_ASSIGNED':
        return this.webhookQueue;

      case 'REMINDER_DUE':
        return this.reminderQueue;

      case 'EMAIL_REQUESTED':
        return this.emailQueue;

      case 'EXPORT_REQUESTED':
        return this.exportQueue;

      default:
        return null;
    }
  }
}
