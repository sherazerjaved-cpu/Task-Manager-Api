import { Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EXPORT_REPOSITORY } from 'src/export/domain/constants/repository.tokens';
import type { IExportRepository } from 'src/export/domain/repositories/export.repository.interface';
import { ExportStatus } from 'src/export/domain/enums/export-status.enum';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { PROCESSED_EVENT_REPOSITORY } from 'src/outbox/domain/constants/repository.tokens';
import type { IProcessedEventRepository } from 'src/outbox/domain/repositories/processed-event.repository.interface';
import { ExportService } from 'src/export/application/export.service';
import { DeadLetterService } from '../queues/dead-letter.service';

@Processor(QUEUE_NAMES.EXPORT)
export class ExportProcessor extends WorkerHost {
  getWorker() {
    return this.worker;
  }

  constructor(
    private readonly logger: PinoLogger,

    @Inject(PROCESSED_EVENT_REPOSITORY)
    private readonly processedEventRepository: IProcessedEventRepository,

    @Inject(EXPORT_REPOSITORY)
    private readonly exportRepository: IExportRepository,

    private readonly exportService: ExportService,

    private readonly deadLetterService: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { outboxEventId, eventType, payload, correlationId } = job.data;

    this.logger.info(
      {
        jobId: job.id,
        queue: QUEUE_NAMES.EXPORT,
        correlationId,
        outboxEventId,
        eventType,
      },
      'Processing export job',
    );

    if (!outboxEventId) {
      throw new Error('Export job is missing outboxEventId');
    }

    if (!eventType) {
      throw new Error('Export job is missing eventType');
    }

    if (!payload) {
      throw new Error('Export job is missing payload');
    }

    if (!payload.exportId) {
      throw new Error('Export job is missing exportId');
    }

    if (eventType !== 'EXPORT_REQUESTED') {
      throw new Error(`Unsupported export event type: ${eventType}`);
    }

    const alreadyProcessed =
      await this.processedEventRepository.hasBeenProcessed(outboxEventId);

    if (alreadyProcessed) {
      this.logger.info(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.EXPORT,
          correlationId,
          outboxEventId,
        },
        'Skipping already processed export event',
      );

      return;
    }

    try {
      await this.exportService.generateExport({
        workspaceId: payload.workspaceId,
        userId: payload.userId,
        format: payload.format,
        outboxEventId,
      });

      await this.processedEventRepository.markProcessed(
        outboxEventId,
        eventType,
      );

      this.logger.info(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.EXPORT,
          correlationId,
          outboxEventId,
        },
        'Export processed successfully',
      );
    } catch (error) {
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;

      const isFinalAttempt = attemptsMade + 1 >= maxAttempts;

      this.logger.error(
        {
          jobId: job.id,
          queue: QUEUE_NAMES.EXPORT,
          correlationId,
          outboxEventId,
          attempt: attemptsMade + 1,
          maxAttempts,
          finalAttempt: isFinalAttempt,
          err: error instanceof Error ? error : undefined,
        },
        'Export job failed',
      );

      if (isFinalAttempt) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unknown export processing error';

        await this.exportRepository.update(payload.exportId, {
          status: ExportStatus.FAILED,
          error: errorMessage,
        });

        this.logger.error(
          {
            jobId: job.id,
            queue: QUEUE_NAMES.EXPORT,
            correlationId,
            outboxEventId,
          },
          'Export permanently failed',
        );
        await this.deadLetterService.moveToDeadLetterQueue({
          queueName: QUEUE_NAMES.EXPORT,
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
            queue: QUEUE_NAMES.EXPORT,
            correlationId,
            outboxEventId,
          },
          'Export permanently failed and moved to DLQ',
        );
      }

      throw error;
    }
  }
}
