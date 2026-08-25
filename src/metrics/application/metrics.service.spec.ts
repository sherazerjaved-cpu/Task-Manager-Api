import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  describe('constructor', () => {
    it('should create a Prometheus registry', () => {
      expect(service.registry).toBeDefined();
    });

    it('should register default metrics', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toContain('process_cpu');
    });

    it('should register the HTTP request counter', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toContain('http_requests_total');
    });

    it('should register the HTTP request duration histogram', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toContain('http_request_duration_seconds');
    });

    it('should register all queue metrics', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toContain('bullmq_queue_waiting_jobs');

      expect(metrics).toContain('bullmq_queue_active_jobs');

      expect(metrics).toContain('bullmq_queue_delayed_jobs');

      expect(metrics).toContain('bullmq_queue_failed_jobs');
    });
  });

  describe('httpRequestsTotal', () => {
    it('should record HTTP request counts with labels', async () => {
      service.httpRequestsTotal.inc({
        method: 'GET',
        route: '/api/v1/tasks',
        status_code: '200',
      });

      const metrics = await service.getMetrics();

      expect(metrics).toContain(
        'http_requests_total{method="GET",route="/api/v1/tasks",status_code="200"} 1',
      );
    });

    it('should support multiple request labels', async () => {
      service.httpRequestsTotal.inc({
        method: 'GET',
        route: '/api/v1/tasks',
        status_code: '200',
      });

      service.httpRequestsTotal.inc({
        method: 'POST',
        route: '/api/v1/tasks',
        status_code: '201',
      });

      const metrics = await service.getMetrics();

      expect(metrics).toContain(
        'http_requests_total{method="GET",route="/api/v1/tasks",status_code="200"} 1',
      );

      expect(metrics).toContain(
        'http_requests_total{method="POST",route="/api/v1/tasks",status_code="201"} 1',
      );
    });
  });

  describe('httpRequestDuration', () => {
    it('should record HTTP request duration', async () => {
      service.httpRequestDuration.observe(
        {
          method: 'GET',
          route: '/api/v1/tasks',
          status_code: '200',
        },
        0.125,
      );

      const metrics = await service.getMetrics();

      expect(metrics).toContain(
        'http_request_duration_seconds_count{method="GET",route="/api/v1/tasks",status_code="200"} 1',
      );

      expect(metrics).toContain(
        'http_request_duration_seconds_sum{method="GET",route="/api/v1/tasks",status_code="200"} 0.125',
      );
    });
  });

  describe('queue metrics', () => {
    it('should record waiting jobs', async () => {
      service.queueWaitingJobs.set({ queue: 'email' }, 5);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('bullmq_queue_waiting_jobs{queue="email"} 5');
    });

    it('should record active jobs', async () => {
      service.queueActiveJobs.set({ queue: 'email' }, 3);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('bullmq_queue_active_jobs{queue="email"} 3');
    });

    it('should record delayed jobs', async () => {
      service.queueDelayedJobs.set({ queue: 'email' }, 7);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('bullmq_queue_delayed_jobs{queue="email"} 7');
    });

    it('should record failed jobs', async () => {
      service.queueFailedJobs.set({ queue: 'email' }, 2);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('bullmq_queue_failed_jobs{queue="email"} 2');
    });

    it('should support metrics for multiple queues', async () => {
      service.queueWaitingJobs.set({ queue: 'email' }, 5);

      service.queueWaitingJobs.set({ queue: 'reminder' }, 8);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('bullmq_queue_waiting_jobs{queue="email"} 5');

      expect(metrics).toContain(
        'bullmq_queue_waiting_jobs{queue="reminder"} 8',
      );
    });
  });

  describe('getMetrics', () => {
    it('should return metrics from the registry', async () => {
      const result = await service.getMetrics();

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return metrics in Prometheus format', async () => {
      const result = await service.getMetrics();

      expect(result).toContain('# HELP');
      expect(result).toContain('# TYPE');
    });
  });

  describe('getContentType', () => {
    it('should return the registry content type', () => {
      expect(service.getContentType()).toBe(service.registry.contentType);
    });

    it('should return a Prometheus content type', () => {
      const contentType = service.getContentType();

      expect(contentType).toContain('text/plain');
    });
  });
});
