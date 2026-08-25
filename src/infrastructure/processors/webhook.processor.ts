import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { QUEUE_NAMES } from '../queues/queue.constants';

import { WebhookService } from 'src/webhook/application/webhook.service';

import { PROCESSED_EVENT_REPOSITORY } from 'src/outbox/domain/constants/repository.tokens';
import type { IProcessedEventRepository } from 'src/outbox/domain/repositories/processed-event.repository.interface';
import { DeadLetterService } from '../queues/dead-letter.service';

@Processor(QUEUE_NAMES.WEBHOOK)
export class WebhookProcessor extends WorkerHost {
  getWorker() {
    return this.worker;
  }
  constructor(
    private readonly logger: PinoLogger,

    private readonly webhookService: WebhookService,

    @Inject(PROCESSED_EVENT_REPOSITORY)
    private readonly processedEventRepository: IProcessedEventRepository,

    private readonly deadLetterService: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { outboxEventId, workspaceId, eventType, payload, correlationId } =
      job.data;

    this.logger.info(
      {
        jobId: job.id,
        queue: QUEUE_NAMES.WEBHOOK,
        correlationId,
        outboxEventId,
        workspaceId,
        eventType,
      },
      'Processing webhook job',
    );
    try {
      if (!outboxEventId) {
        throw new Error('Webhook job is missing outboxEventId');
      }

      if (!workspaceId) {
        throw new Error('Webhook job is missing workspaceId');
      }

      if (!eventType) {
        throw new Error('Webhook job is missing eventType');
      }

      if (!payload) {
        throw new Error('Webhook job is missing payload');
      }

      const alreadyProcessed =
        await this.processedEventRepository.hasBeenProcessed(outboxEventId);

      if (alreadyProcessed) {
        this.logger.info(
          {
            jobId: job.id,
            queue: QUEUE_NAMES.WEBHOOK,
            correlationId,
            outboxEventId,
          },
          'Skipping already processed webhook event',
        );

        return;
      }

      await this.webhookService.deliverToWorkspace(
        workspaceId,
        outboxEventId,
        eventType,
        payload,
        job.attemptsMade + 1,
      );

      await this.processedEventRepository.markProcessed(
        outboxEventId,
        eventType,
      );

      this.logger.info(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.WEBHOOK,
          correlationId,
          outboxEventId,
        },
        'Webhook processed successfully',
      );
    } catch (error) {
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;

      const isFinalAttempt = attemptsMade + 1 >= maxAttempts;

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown webhook processing error';

      this.logger.error(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.WEBHOOK,
          correlationId,
          outboxEventId,
          attempt: attemptsMade + 1,
          maxAttempts,
          finalAttempt: isFinalAttempt,
          err: error instanceof Error ? error : undefined,
        },
        'Webhook job failed',
      );

      if (isFinalAttempt) {
        await this.deadLetterService.moveToDeadLetterQueue({
          queueName: QUEUE_NAMES.WEBHOOK,
          jobId: job.id?.toString(),
          outboxEventId,
          eventType,
          payload,
          error: errorMessage,
          attempts: attemptsMade + 1,
          correlationId,
        });

        this.logger.error(
          {
            jobId: job.id,
            queue: QUEUE_NAMES.WEBHOOK,
            correlationId,
            outboxEventId,
          },
          'Webhook moved to DLQ',
        );
      }

      throw error;
    }
  }
}
