import { Response } from 'express';

import { MetricsController } from './metrics.controller';
import { MetricsService } from '../application/metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;

  let metricsService: {
    getMetrics: jest.Mock;
    getContentType: jest.Mock;
  };

  let response: {
    setHeader: jest.Mock;
    send: jest.Mock;
  };

  beforeEach(() => {
    metricsService = {
      getMetrics: jest.fn(),
      getContentType: jest.fn(),
    };

    controller = new MetricsController(
      metricsService as unknown as MetricsService,
    );

    response = {
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('getMetrics', () => {
    it('should return Prometheus metrics', async () => {
      const metrics = [
        '# HELP http_requests_total Total number of HTTP requests',
        '# TYPE http_requests_total counter',
        'http_requests_total{method="GET"} 5',
      ].join('\n');

      metricsService.getMetrics.mockResolvedValue(metrics);
      metricsService.getContentType.mockReturnValue(
        'text/plain; version=0.0.4; charset=utf-8',
      );

      await controller.getMetrics(response as unknown as Response);

      expect(metricsService.getMetrics).toHaveBeenCalledTimes(1);

      expect(response.send).toHaveBeenCalledWith(metrics);
    });

    it('should set the Prometheus content type', async () => {
      const contentType = 'text/plain; version=0.0.4; charset=utf-8';

      metricsService.getContentType.mockReturnValue(contentType);
      metricsService.getMetrics.mockResolvedValue('metrics');

      await controller.getMetrics(response as unknown as Response);

      expect(metricsService.getContentType).toHaveBeenCalledTimes(1);

      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        contentType,
      );
    });

    it('should send the metrics returned by the service', async () => {
      const metrics = 'http_requests_total 10\n';

      metricsService.getMetrics.mockResolvedValue(metrics);
      metricsService.getContentType.mockReturnValue('text/plain');

      await controller.getMetrics(response as unknown as Response);

      expect(response.send).toHaveBeenCalledTimes(1);
      expect(response.send).toHaveBeenCalledWith(metrics);
    });

    it('should set the header before sending the response', async () => {
      const callOrder: string[] = [];

      response.setHeader.mockImplementation(() => {
        callOrder.push('setHeader');
        return response;
      });

      response.send.mockImplementation(() => {
        callOrder.push('send');
        return response;
      });

      metricsService.getContentType.mockReturnValue('text/plain');

      metricsService.getMetrics.mockResolvedValue('metrics');

      await controller.getMetrics(response as unknown as Response);

      expect(callOrder).toEqual(['setHeader', 'send']);
    });

    it('should propagate an error when metrics generation fails', async () => {
      const error = new Error('Failed to generate metrics');

      metricsService.getMetrics.mockRejectedValue(error);
      metricsService.getContentType.mockReturnValue('text/plain');

      await expect(
        controller.getMetrics(response as unknown as Response),
      ).rejects.toThrow('Failed to generate metrics');

      expect(response.send).not.toHaveBeenCalled();
    });

    it('should get the content type from the metrics service', async () => {
      metricsService.getContentType.mockReturnValue(
        'application/openmetrics-text; version=1.0.0; charset=utf-8',
      );

      metricsService.getMetrics.mockResolvedValue('metrics');

      await controller.getMetrics(response as unknown as Response);

      expect(metricsService.getContentType).toHaveBeenCalledTimes(1);

      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/openmetrics-text; version=1.0.0; charset=utf-8',
      );
    });

    it('should not send a response when getMetrics fails', async () => {
      metricsService.getMetrics.mockRejectedValue(
        new Error('Metrics unavailable'),
      );

      metricsService.getContentType.mockReturnValue('text/plain');

      await expect(
        controller.getMetrics(response as unknown as Response),
      ).rejects.toThrow('Metrics unavailable');

      expect(response.send).not.toHaveBeenCalled();
    });
  });
});
