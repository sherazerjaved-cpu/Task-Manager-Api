import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { Types } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import { DeadLetterService } from '../queues/dead-letter.service';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { MailService } from 'src/mail/mail.service';

import { EMAIL_DELIVERY_REPOSITORY } from 'src/mail/domain/constants/repository.tokens';
import type { IEmailDeliveryRepository } from 'src/mail/domain/repositories/email-delivery.repository.interface';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  getWorker() {
    return this.worker;
  }
  constructor(
    private readonly logger: PinoLogger,

    private readonly mailService: MailService,

    @Inject(EMAIL_DELIVERY_REPOSITORY)
    private readonly emailDeliveryRepository: IEmailDeliveryRepository,

    private readonly deadLetterService: DeadLetterService,
  ) {
    super();

    this.logger.setContext(EmailProcessor.name);
  }

  async process(job: Job): Promise<void> {
    const { correlationId } = job.data;

    this.logger.info(
      {
        jobId: job.id,
        queue: QUEUE_NAMES.EMAIL,
        correlationId,
      },
      'Processing email job',
    );

    const { eventType, payload, outboxEventId } = job.data;

    if (!eventType) {
      throw new Error('Email job is missing eventType');
    }

    if (!payload) {
      throw new Error('Email job is missing payload');
    }

    if (!outboxEventId) {
      throw new Error('Email job is missing outboxEventId');
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
      await this.emailDeliveryRepository.update(delivery._id.toString(), {
        status: EmailDeliveryStatus.SENDING,
        attempts: job.attemptsMade + 1,
      });

      switch (eventType) {
        case 'EMAIL_REQUESTED':
          await this.processEmailRequested(payload);
          break;

        default:
          throw new Error(`Unsupported email event type: ${eventType}`);
      }

      await this.emailDeliveryRepository.update(delivery._id.toString(), {
        status: EmailDeliveryStatus.SENT,
        sentAt: new Date(),
        lastError: undefined,
      });

      this.logger.info(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.EMAIL,
          correlationId,
        },
        'Email job processed successfully',
      );
    } catch (error) {
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;

      const currentAttempt = attemptsMade + 1;

      const isFinalAttempt = currentAttempt >= maxAttempts;

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown email processing error';

      this.logger.error(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.EMAIL,
          correlationId,
          attempt: currentAttempt,
          maxAttempts,
          finalAttempt: isFinalAttempt,
          err: error instanceof Error ? error : undefined,
        },
        'Email job failed',
      );

      if (isFinalAttempt) {
        await this.emailDeliveryRepository.update(delivery._id.toString(), {
          status: EmailDeliveryStatus.FAILED,
          failedAt: new Date(),
          lastError: errorMessage,
          attempts: currentAttempt,
        });

        await this.deadLetterService.moveToDeadLetterQueue({
          queueName: QUEUE_NAMES.EMAIL,
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
            queue: QUEUE_NAMES.EMAIL,
            correlationId,
          },
          'Email permanently failed and moved to DLQ',
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

  private async processEmailRequested(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const emailType = payload.emailType;
    const to = payload.to;

    if (typeof emailType !== 'string' || typeof to !== 'string') {
      throw new Error('EMAIL_REQUESTED payload is invalid');
    }

    switch (emailType) {
      case 'EMAIL_VERIFICATION':
        await this.mailService.sendVerificationEmail(
          to,
          String(payload.token),
          new Date(String(payload.expiresAt)),
        );
        break;

      case 'PASSWORD_RESET':
        await this.mailService.sendPasswordResetEmail(
          to,
          String(payload.token),
          new Date(String(payload.expiresAt)),
        );
        break;

      case 'WORKSPACE_INVITATION':
        await this.mailService.sendWorkspaceInvitation(
          to,
          String(payload.workspaceName),
          String(payload.token),
          new Date(String(payload.expiresAt)),
        );
        break;

      case 'TASK_REMINDER':
        await this.mailService.sendReminderEmail(
          to,
          String(payload.taskTitle),
          new Date(String(payload.dueDate)),
          String(payload.priority),
        );
        break;

      default:
        throw new Error(`Unsupported email type: ${emailType}`);
    }
  }
}
