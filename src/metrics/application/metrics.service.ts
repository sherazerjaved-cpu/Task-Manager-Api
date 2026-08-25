import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry: Registry;

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;

  readonly queueWaitingJobs: Gauge<string>;
  readonly queueActiveJobs: Gauge<string>;
  readonly queueDelayedJobs: Gauge<string>;
  readonly queueFailedJobs: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({
      register: this.registry,
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.queueWaitingJobs = new Gauge({
      name: 'bullmq_queue_waiting_jobs',
      help: 'Number of waiting jobs in a BullMQ queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueActiveJobs = new Gauge({
      name: 'bullmq_queue_active_jobs',
      help: 'Number of active jobs in a BullMQ queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueDelayedJobs = new Gauge({
      name: 'bullmq_queue_delayed_jobs',
      help: 'Number of delayed jobs in a BullMQ queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueFailedJobs = new Gauge({
      name: 'bullmq_queue_failed_jobs',
      help: 'Number of failed jobs in a BullMQ queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
