import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QueueMetricsService } from './queue-metrics.service';
import { QUEUE_NAMES } from './queue.constants';
import { MetricsService } from 'src/metrics/application/metrics.service';

describe('QueueMetricsService', () => {
  let service: QueueMetricsService;

  let metricsService: {
    queueWaitingJobs: {
      set: jest.Mock;
    };
    queueActiveJobs: {
      set: jest.Mock;
    };
    queueDelayedJobs: {
      set: jest.Mock;
    };
    queueFailedJobs: {
      set: jest.Mock;
    };
  };

  let emailQueue: {
    getJobCounts: jest.Mock;
  };

  let reminderQueue: {
    getJobCounts: jest.Mock;
  };

  let webhookQueue: {
    getJobCounts: jest.Mock;
  };

  let exportQueue: {
    getJobCounts: jest.Mock;
  };

  let dlqQueue: {
    getJobCounts: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    metricsService = {
      queueWaitingJobs: {
        set: jest.fn(),
      },
      queueActiveJobs: {
        set: jest.fn(),
      },
      queueDelayedJobs: {
        set: jest.fn(),
      },
      queueFailedJobs: {
        set: jest.fn(),
      },
    };

    emailQueue = {
      getJobCounts: jest.fn(),
    };

    reminderQueue = {
      getJobCounts: jest.fn(),
    };

    webhookQueue = {
      getJobCounts: jest.fn(),
    };

    exportQueue = {
      getJobCounts: jest.fn(),
    };

    dlqQueue = {
      getJobCounts: jest.fn(),
    };

    service = new QueueMetricsService(
      metricsService as unknown as MetricsService,
      emailQueue as unknown as Queue,
      reminderQueue as unknown as Queue,
      webhookQueue as unknown as Queue,
      exportQueue as unknown as Queue,
      dlqQueue as unknown as Queue,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('updateMetrics', () => {
    it('should collect metrics from all queues', async () => {
      emailQueue.getJobCounts.mockResolvedValue({
        waiting: 5,
        active: 2,
        delayed: 1,
        failed: 3,
      });

      reminderQueue.getJobCounts.mockResolvedValue({
        waiting: 10,
        active: 4,
        delayed: 2,
        failed: 1,
      });

      webhookQueue.getJobCounts.mockResolvedValue({
        waiting: 7,
        active: 3,
        delayed: 5,
        failed: 2,
      });

      exportQueue.getJobCounts.mockResolvedValue({
        waiting: 8,
        active: 1,
        delayed: 4,
        failed: 6,
      });

      dlqQueue.getJobCounts.mockResolvedValue({
        waiting: 9,
        active: 0,
        delayed: 0,
        failed: 11,
      });

      await service.updateMetrics();

      expect(emailQueue.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'delayed',
        'failed',
      );

      expect(reminderQueue.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'delayed',
        'failed',
      );

      expect(webhookQueue.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'delayed',
        'failed',
      );

      expect(exportQueue.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'delayed',
        'failed',
      );

      expect(dlqQueue.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
    });

    it('should update waiting job metrics for every queue', async () => {
      emailQueue.getJobCounts.mockResolvedValue({ waiting: 5 });
      reminderQueue.getJobCounts.mockResolvedValue({ waiting: 10 });
      webhookQueue.getJobCounts.mockResolvedValue({ waiting: 15 });
      exportQueue.getJobCounts.mockResolvedValue({ waiting: 20 });
      dlqQueue.getJobCounts.mockResolvedValue({ waiting: 25 });

      await service.updateMetrics();

      expect(metricsService.queueWaitingJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        5,
      );

      expect(metricsService.queueWaitingJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.REMINDER },
        10,
      );

      expect(metricsService.queueWaitingJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.WEBHOOK },
        15,
      );

      expect(metricsService.queueWaitingJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EXPORT },
        20,
      );

      expect(metricsService.queueWaitingJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.DLQ },
        25,
      );
    });

    it('should update active job metrics for every queue', async () => {
      emailQueue.getJobCounts.mockResolvedValue({ active: 1 });
      reminderQueue.getJobCounts.mockResolvedValue({ active: 2 });
      webhookQueue.getJobCounts.mockResolvedValue({ active: 3 });
      exportQueue.getJobCounts.mockResolvedValue({ active: 4 });
      dlqQueue.getJobCounts.mockResolvedValue({ active: 5 });

      await service.updateMetrics();

      expect(metricsService.queueActiveJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        1,
      );

      expect(metricsService.queueActiveJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.REMINDER },
        2,
      );

      expect(metricsService.queueActiveJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.WEBHOOK },
        3,
      );

      expect(metricsService.queueActiveJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EXPORT },
        4,
      );

      expect(metricsService.queueActiveJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.DLQ },
        5,
      );
    });

    it('should update delayed job metrics for every queue', async () => {
      emailQueue.getJobCounts.mockResolvedValue({ delayed: 2 });
      reminderQueue.getJobCounts.mockResolvedValue({ delayed: 4 });
      webhookQueue.getJobCounts.mockResolvedValue({ delayed: 6 });
      exportQueue.getJobCounts.mockResolvedValue({ delayed: 8 });
      dlqQueue.getJobCounts.mockResolvedValue({ delayed: 10 });

      await service.updateMetrics();

      expect(metricsService.queueDelayedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        2,
      );

      expect(metricsService.queueDelayedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.REMINDER },
        4,
      );

      expect(metricsService.queueDelayedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.WEBHOOK },
        6,
      );

      expect(metricsService.queueDelayedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EXPORT },
        8,
      );

      expect(metricsService.queueDelayedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.DLQ },
        10,
      );
    });

    it('should update failed job metrics for every queue', async () => {
      emailQueue.getJobCounts.mockResolvedValue({ failed: 3 });
      reminderQueue.getJobCounts.mockResolvedValue({ failed: 6 });
      webhookQueue.getJobCounts.mockResolvedValue({ failed: 9 });
      exportQueue.getJobCounts.mockResolvedValue({ failed: 12 });
      dlqQueue.getJobCounts.mockResolvedValue({ failed: 15 });

      await service.updateMetrics();

      expect(metricsService.queueFailedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        3,
      );

      expect(metricsService.queueFailedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.REMINDER },
        6,
      );

      expect(metricsService.queueFailedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.WEBHOOK },
        9,
      );

      expect(metricsService.queueFailedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EXPORT },
        12,
      );

      expect(metricsService.queueFailedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.DLQ },
        15,
      );
    });

    it('should treat missing queue counts as zero', async () => {
      emailQueue.getJobCounts.mockResolvedValue({});

      reminderQueue.getJobCounts.mockResolvedValue({});

      webhookQueue.getJobCounts.mockResolvedValue({});

      exportQueue.getJobCounts.mockResolvedValue({});

      dlqQueue.getJobCounts.mockResolvedValue({});

      await service.updateMetrics();

      expect(metricsService.queueWaitingJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        0,
      );

      expect(metricsService.queueActiveJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        0,
      );

      expect(metricsService.queueDelayedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        0,
      );

      expect(metricsService.queueFailedJobs.set).toHaveBeenCalledWith(
        { queue: QUEUE_NAMES.EMAIL },
        0,
      );
    });

    it('should continue to the error handler when queue metrics fail', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      emailQueue.getJobCounts.mockRejectedValue(new Error('Redis unavailable'));

      await expect(service.updateMetrics()).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to update BullMQ queue metrics',
        expect.any(String),
      );

      expect(metricsService.queueWaitingJobs.set).not.toHaveBeenCalled();

      loggerErrorSpy.mockRestore();
    });

    it('should handle non-Error queue failures', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      emailQueue.getJobCounts.mockRejectedValue('Redis unavailable');

      await expect(service.updateMetrics()).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to update BullMQ queue metrics',
        'Redis unavailable',
      );

      loggerErrorSpy.mockRestore();
    });
  });

  describe('onModuleInit', () => {
    it('should immediately update metrics and start the interval', () => {
      const updateMetricsSpy = jest
        .spyOn(service, 'updateMetrics')
        .mockResolvedValue(undefined);

      service.onModuleInit();

      expect(updateMetricsSpy).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(1);
    });

    it('should update metrics every 10 seconds', async () => {
      const updateMetricsSpy = jest
        .spyOn(service, 'updateMetrics')
        .mockResolvedValue(undefined);

      service.onModuleInit();

      expect(updateMetricsSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(10_000);

      expect(updateMetricsSpy).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(10_000);

      expect(updateMetricsSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear the metrics interval', () => {
      service.onModuleInit();

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      service.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

      clearIntervalSpy.mockRestore();
    });

    it('should safely do nothing when no interval exists', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });

    it('should set the interval reference to undefined after destruction', () => {
      service.onModuleInit();

      service.onModuleDestroy();

      // Calling destroy a second time should not clear another interval.
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      service.onModuleDestroy();

      expect(clearIntervalSpy).not.toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });
  });
});
