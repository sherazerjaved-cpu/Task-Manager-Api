import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { ExportProcessor } from './export.processor';
import { ExportService } from 'src/export/application/export.service';
import { ExportStatus } from 'src/export/domain/enums/export-status.enum';
import type { IExportRepository } from 'src/export/domain/repositories/export.repository.interface';
import type { IProcessedEventRepository } from 'src/outbox/domain/repositories/processed-event.repository.interface';
import { DeadLetterService } from '../queues/dead-letter.service';
import { QUEUE_NAMES } from '../queues/queue.constants';

describe('ExportProcessor', () => {
  let processor: ExportProcessor;

  let logger: {
    info: jest.Mock;
    error: jest.Mock;
  };

  let processedEventRepository: {
    hasBeenProcessed: jest.Mock;
    markProcessed: jest.Mock;
  };

  let exportRepository: {
    update: jest.Mock;
  };

  let exportService: {
    generateExport: jest.Mock;
  };

  let deadLetterService: {
    moveToDeadLetterQueue: jest.Mock;
  };

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    processedEventRepository = {
      hasBeenProcessed: jest.fn(),
      markProcessed: jest.fn(),
    };

    exportRepository = {
      update: jest.fn(),
    };

    exportService = {
      generateExport: jest.fn(),
    };

    deadLetterService = {
      moveToDeadLetterQueue: jest.fn(),
    };

    processor = new ExportProcessor(
      logger as unknown as PinoLogger,
      processedEventRepository as unknown as IProcessedEventRepository,
      exportRepository as unknown as IExportRepository,
      exportService as unknown as ExportService,
      deadLetterService as unknown as DeadLetterService,
    );
  });

  describe('process', () => {
    it('should process an export successfully', async () => {
      const job = {
        id: 'export-job-1',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-123',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-123',
          payload: {
            exportId: 'export-123',
            workspaceId: 'workspace-123',
            userId: 'user-123',
            format: 'CSV',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);
      exportService.generateExport.mockResolvedValue(undefined);
      processedEventRepository.markProcessed.mockResolvedValue(undefined);

      await processor.process(job);

      expect(processedEventRepository.hasBeenProcessed).toHaveBeenCalledWith(
        'outbox-123',
      );

      expect(exportService.generateExport).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'CSV',
        outboxEventId: 'outbox-123',
      });

      expect(processedEventRepository.markProcessed).toHaveBeenCalledWith(
        'outbox-123',
        'EXPORT_REQUESTED',
      );

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith(
        {
          jobId: 'export-job-1',
          queue: QUEUE_NAMES.EXPORT,
          correlationId: 'corr-123',
          outboxEventId: 'outbox-123',
        },
        'Export processed successfully',
      );
    });

    it('should skip an already processed export event', async () => {
      const job = {
        id: 'export-job-2',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-456',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-456',
          payload: {
            exportId: 'export-456',
            workspaceId: 'workspace-456',
            userId: 'user-456',
            format: 'JSON',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(true);

      await processor.process(job);

      expect(processedEventRepository.hasBeenProcessed).toHaveBeenCalledWith(
        'outbox-456',
      );

      expect(exportService.generateExport).not.toHaveBeenCalled();

      expect(processedEventRepository.markProcessed).not.toHaveBeenCalled();

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith(
        {
          jobId: 'export-job-2',
          queue: QUEUE_NAMES.EXPORT,
          correlationId: 'corr-456',
          outboxEventId: 'outbox-456',
        },
        'Skipping already processed export event',
      );
    });

    it('should throw when outboxEventId is missing', async () => {
      const job = {
        id: 'export-job-3',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-1',
          payload: {
            exportId: 'export-1',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Export job is missing outboxEventId',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();

      expect(exportService.generateExport).not.toHaveBeenCalled();
    });

    it('should throw when eventType is missing', async () => {
      const job = {
        id: 'export-job-4',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-1',
          correlationId: 'corr-2',
          payload: {
            exportId: 'export-1',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Export job is missing eventType',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();
    });

    it('should throw when payload is missing', async () => {
      const job = {
        id: 'export-job-5',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-1',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-3',
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Export job is missing payload',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();
    });

    it('should throw when exportId is missing', async () => {
      const job = {
        id: 'export-job-6',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-1',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-4',
          payload: {
            workspaceId: 'workspace-1',
            userId: 'user-1',
            format: 'CSV',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Export job is missing exportId',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();
    });

    it('should throw for an unsupported event type', async () => {
      const job = {
        id: 'export-job-7',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-1',
          eventType: 'UNKNOWN_EVENT',
          correlationId: 'corr-5',
          payload: {
            exportId: 'export-1',
          },
        },
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Unsupported export event type: UNKNOWN_EVENT',
      );

      expect(processedEventRepository.hasBeenProcessed).not.toHaveBeenCalled();

      expect(exportService.generateExport).not.toHaveBeenCalled();
    });

    it('should rethrow an error when export generation fails and attempts remain', async () => {
      const job = {
        id: 'export-job-8',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-retry',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-retry',
          payload: {
            exportId: 'export-retry',
            workspaceId: 'workspace-retry',
            userId: 'user-retry',
            format: 'CSV',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      exportService.generateExport.mockRejectedValue(
        new Error('Export generation failed'),
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Export generation failed',
      );

      expect(exportService.generateExport).toHaveBeenCalled();

      expect(exportRepository.update).not.toHaveBeenCalled();

      expect(deadLetterService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      expect(logger.error).toHaveBeenCalledWith(
        {
          jobId: 'export-job-8',
          queue: QUEUE_NAMES.EXPORT,
          correlationId: 'corr-retry',
          outboxEventId: 'outbox-retry',
          attempt: 1,
          maxAttempts: 3,
          finalAttempt: false,
          err: expect.any(Error),
        },
        'Export job failed',
      );
    });

    it('should mark export as FAILED and move it to DLQ on the final attempt', async () => {
      const job = {
        id: 'export-job-9',
        attemptsMade: 2,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-final',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-final',
          payload: {
            exportId: 'export-final',
            workspaceId: 'workspace-final',
            userId: 'user-final',
            format: 'XLSX',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      exportService.generateExport.mockRejectedValue(
        new Error('Export failed permanently'),
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Export failed permanently',
      );

      expect(exportRepository.update).toHaveBeenCalledWith('export-final', {
        status: ExportStatus.FAILED,
        error: 'Export failed permanently',
      });

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.EXPORT,
        jobId: 'export-job-9',
        outboxEventId: 'outbox-final',
        eventType: 'EXPORT_REQUESTED',
        payload: job.data.payload,
        error: 'Export failed permanently',
        attempts: 3,
        correlationId: 'corr-final',
      });

      expect(logger.error).toHaveBeenCalledWith(
        {
          jobId: 'export-job-9',
          queue: QUEUE_NAMES.EXPORT,
          correlationId: 'corr-final',
          outboxEventId: 'outbox-final',
        },
        'Export permanently failed',
      );

      expect(logger.error).toHaveBeenCalledWith(
        {
          jobId: 'export-job-9',
          queue: QUEUE_NAMES.EXPORT,
          correlationId: 'corr-final',
          outboxEventId: 'outbox-final',
        },
        'Export permanently failed and moved to DLQ',
      );
    });

    it('should handle a non-Error failure on the final attempt', async () => {
      const job = {
        id: 'export-job-10',
        attemptsMade: 0,
        opts: {
          attempts: 1,
        },
        data: {
          outboxEventId: 'outbox-string-error',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-string-error',
          payload: {
            exportId: 'export-string-error',
            workspaceId: 'workspace-1',
            userId: 'user-1',
            format: 'JSON',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      exportService.generateExport.mockRejectedValue('Export service failed');

      await expect(processor.process(job)).rejects.toBe(
        'Export service failed',
      );

      expect(exportRepository.update).toHaveBeenCalledWith(
        'export-string-error',
        {
          status: ExportStatus.FAILED,
          error: 'Unknown export processing error',
        },
      );

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith({
        queueName: QUEUE_NAMES.EXPORT,
        jobId: 'export-job-10',
        outboxEventId: 'outbox-string-error',
        eventType: 'EXPORT_REQUESTED',
        payload: job.data.payload,
        error: 'Unknown export processing error',
        attempts: 1,
        correlationId: 'corr-string-error',
      });
    });

    it('should use one attempt when job options do not specify attempts', async () => {
      const job = {
        id: 'export-job-11',
        attemptsMade: 0,
        opts: {},
        data: {
          outboxEventId: 'outbox-default',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-default',
          payload: {
            exportId: 'export-default',
            workspaceId: 'workspace-1',
            userId: 'user-1',
            format: 'CSV',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      exportService.generateExport.mockRejectedValue(
        new Error('Export failed'),
      );

      await expect(processor.process(job)).rejects.toThrow('Export failed');

      expect(exportRepository.update).toHaveBeenCalledWith('export-default', {
        status: ExportStatus.FAILED,
        error: 'Export failed',
      });

      expect(deadLetterService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: 1,
          error: 'Export failed',
        }),
      );
    });

    it('should not mark the event as processed when export generation fails', async () => {
      const job = {
        id: 'export-job-12',
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        data: {
          outboxEventId: 'outbox-failed',
          eventType: 'EXPORT_REQUESTED',
          correlationId: 'corr-failed',
          payload: {
            exportId: 'export-failed',
            workspaceId: 'workspace-1',
            userId: 'user-1',
            format: 'CSV',
          },
        },
      } as unknown as Job;

      processedEventRepository.hasBeenProcessed.mockResolvedValue(false);

      exportService.generateExport.mockRejectedValue(
        new Error('Generation error'),
      );

      await expect(processor.process(job)).rejects.toThrow('Generation error');

      expect(processedEventRepository.markProcessed).not.toHaveBeenCalled();
    });
  });
});
