import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MetricsService } from 'src/metrics/application/metrics.service';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly metricsService: MetricsService,

    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emailQueue: Queue,

    @InjectQueue(QUEUE_NAMES.REMINDER)
    private readonly reminderQueue: Queue,

    @InjectQueue(QUEUE_NAMES.WEBHOOK)
    private readonly webhookQueue: Queue,

    @InjectQueue(QUEUE_NAMES.EXPORT)
    private readonly exportQueue: Queue,

    @InjectQueue(QUEUE_NAMES.DLQ)
    private readonly dlqQueue: Queue,
  ) {}

  onModuleInit(): void {
    void this.updateMetrics();

    this.interval = setInterval(() => {
      void this.updateMetrics();
    }, 10_000);
  }

  async updateMetrics(): Promise<void> {
    const queues = [
      {
        name: QUEUE_NAMES.EMAIL,
        queue: this.emailQueue,
      },
      {
        name: QUEUE_NAMES.REMINDER,
        queue: this.reminderQueue,
      },
      {
        name: QUEUE_NAMES.WEBHOOK,
        queue: this.webhookQueue,
      },
      {
        name: QUEUE_NAMES.EXPORT,
        queue: this.exportQueue,
      },
      {
        name: QUEUE_NAMES.DLQ,
        queue: this.dlqQueue,
      },
    ];

    try {
      for (const { name, queue } of queues) {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
        );

        this.metricsService.queueWaitingJobs.set(
          { queue: name },
          counts.waiting ?? 0,
        );

        this.metricsService.queueActiveJobs.set(
          { queue: name },
          counts.active ?? 0,
        );

        this.metricsService.queueDelayedJobs.set(
          { queue: name },
          counts.delayed ?? 0,
        );

        this.metricsService.queueFailedJobs.set(
          { queue: name },
          counts.failed ?? 0,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to update BullMQ queue metrics',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
