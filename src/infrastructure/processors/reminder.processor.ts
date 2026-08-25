import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Types } from 'mongoose';

import { QUEUE_NAMES } from '../queues/queue.constants';
import { MailService } from 'src/mail/mail.service';

import { PROCESSED_EVENT_REPOSITORY } from 'src/outbox/domain/constants/repository.tokens';
import type { IProcessedEventRepository } from 'src/outbox/domain/repositories/processed-event.repository.interface';

import { EMAIL_DELIVERY_REPOSITORY } from 'src/mail/domain/constants/repository.tokens';
import type { IEmailDeliveryRepository } from 'src/mail/domain/repositories/email-delivery.repository.interface';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

import { DeadLetterService } from '../queues/dead-letter.service';

@Processor(QUEUE_NAMES.REMINDER)
export class ReminderProcessor extends WorkerHost {
  getWorker() {
    return this.worker;
  }
  constructor(
    private readonly logger: PinoLogger,

    private readonly mailService: MailService,

    @Inject(PROCESSED_EVENT_REPOSITORY)
    private readonly processedEventRepository: IProcessedEventRepository,

    @Inject(EMAIL_DELIVERY_REPOSITORY)
    private readonly emailDeliveryRepository: IEmailDeliveryRepository,

    private readonly deadLetterService: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { outboxEventId, eventType, payload, correlationId } = job.data;

    this.logger.info(
      {
        jobId: job.id,
        queue: QUEUE_NAMES.REMINDER,
        correlationId,
        outboxEventId,
        eventType,
      },
      'Processing reminder job',
    );

    if (!outboxEventId) {
      throw new Error('Reminder job is missing outboxEventId');
    }

    if (!eventType) {
      throw new Error('Reminder job is missing eventType');
    }

    if (!payload) {
      throw new Error('Reminder job is missing payload');
    }

    const alreadyProcessed =
      await this.processedEventRepository.hasBeenProcessed(outboxEventId);

    if (alreadyProcessed) {
      this.logger.info(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.REMINDER,
          correlationId,
          outboxEventId,
        },
        'Skipping already processed reminder event',
      );

      return;
    }

    const delivery = await this.emailDeliveryRepository.findByOutboxEventId(
      new Types.ObjectId(outboxEventId),
    );

    if (!delivery) {
      throw new Error(
        `Email delivery record not found for outbox event ${outboxEventId}`,
      );
    }

    try {
      if (eventType !== 'REMINDER_DUE') {
        throw new Error(`Unsupported reminder event type: ${eventType}`);
      }

      const { to, taskTitle, dueDate, priority } = payload;

      if (
        typeof to !== 'string' ||
        typeof taskTitle !== 'string' ||
        typeof priority !== 'string' ||
        !dueDate
      ) {
        throw new Error('REMINDER_DUE payload is invalid');
      }

      await this.emailDeliveryRepository.update(delivery._id.toString(), {
        status: EmailDeliveryStatus.SENDING,
        attempts: job.attemptsMade + 1,
      });

      await this.mailService.sendReminderEmail(
        to,
        taskTitle,
        new Date(String(dueDate)),
        priority,
      );

      await this.emailDeliveryRepository.update(delivery._id.toString(), {
        status: EmailDeliveryStatus.SENT,
        sentAt: new Date(),
        lastError: undefined,
      });

      await this.processedEventRepository.markProcessed(
        outboxEventId,
        eventType,
      );

      this.logger.info(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.REMINDER,
          correlationId,
          outboxEventId,
        },
        'Reminder processed successfully',
      );
    } catch (error) {
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;

      const currentAttempt = attemptsMade + 1;

      const isFinalAttempt = currentAttempt >= maxAttempts;

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown reminder processing error';

      this.logger.error(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.REMINDER,
          correlationId,
          outboxEventId,
          attempt: currentAttempt,
          maxAttempts,
          finalAttempt: isFinalAttempt,
          err: error instanceof Error ? error : undefined,
        },
        'Reminder job failed',
      );

      if (isFinalAttempt) {
        await this.emailDeliveryRepository.update(delivery._id.toString(), {
          status: EmailDeliveryStatus.FAILED,
          failedAt: new Date(),
          lastError: errorMessage,
          attempts: currentAttempt,
        });

        await this.deadLetterService.moveToDeadLetterQueue({
          queueName: QUEUE_NAMES.REMINDER,
          jobId: job.id?.toString(),
          outboxEventId,
          eventType,
          payload,
          error: errorMessage,
          attempts: currentAttempt,
          correlationId,
        });

        this.logger.error(
          {
            jobId: job.id,
            queue: QUEUE_NAMES.REMINDER,
            correlationId,
            outboxEventId,
          },
          'Reminder permanently failed and moved to DLQ',
        );
      } else {
        await this.emailDeliveryRepository.update(delivery._id.toString(), {
          attempts: currentAttempt,
          lastError: errorMessage,
        });
      }
      throw error;
    }
  }
}
