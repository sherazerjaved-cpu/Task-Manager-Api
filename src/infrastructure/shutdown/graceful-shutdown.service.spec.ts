import { Logger } from '@nestjs/common';
import { Connection } from 'mongoose';

import { GracefulShutdownService } from './graceful-shutdown.service';
import { EmailProcessor } from '../processors/email.processor';
import { ReminderProcessor } from '../processors/reminder.processor';
import { WebhookProcessor } from '../processors/webhook.processor';
import { ExportProcessor } from '../processors/export.processor';
import { DeadLetterProcessor } from '../processors/dead-letter.processor';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;

  let mongoConnection: {
    readyState: number;
    close: jest.Mock;
  };

  let emailWorker: {
    close: jest.Mock;
  };

  let reminderWorker: {
    close: jest.Mock;
  };

  let webhookWorker: {
    close: jest.Mock;
  };

  let exportWorker: {
    close: jest.Mock;
  };

  let deadLetterWorker: {
    close: jest.Mock;
  };

  let emailProcessor: {
    getWorker: jest.Mock;
  };

  let reminderProcessor: {
    getWorker: jest.Mock;
  };

  let webhookProcessor: {
    getWorker: jest.Mock;
  };

  let exportProcessor: {
    getWorker: jest.Mock;
  };

  let deadLetterProcessor: {
    getWorker: jest.Mock;
  };

  beforeEach(() => {
    mongoConnection = {
      readyState: 1,
      close: jest.fn().mockResolvedValue(undefined),
    };

    emailWorker = {
      close: jest.fn().mockResolvedValue(undefined),
    };

    reminderWorker = {
      close: jest.fn().mockResolvedValue(undefined),
    };

    webhookWorker = {
      close: jest.fn().mockResolvedValue(undefined),
    };

    exportWorker = {
      close: jest.fn().mockResolvedValue(undefined),
    };

    deadLetterWorker = {
      close: jest.fn().mockResolvedValue(undefined),
    };

    emailProcessor = {
      getWorker: jest.fn().mockReturnValue(emailWorker),
    };

    reminderProcessor = {
      getWorker: jest.fn().mockReturnValue(reminderWorker),
    };

    webhookProcessor = {
      getWorker: jest.fn().mockReturnValue(webhookWorker),
    };

    exportProcessor = {
      getWorker: jest.fn().mockReturnValue(exportWorker),
    };

    deadLetterProcessor = {
      getWorker: jest.fn().mockReturnValue(deadLetterWorker),
    };

    service = new GracefulShutdownService(
      mongoConnection as unknown as Connection,
      emailProcessor as unknown as EmailProcessor,
      reminderProcessor as unknown as ReminderProcessor,
      webhookProcessor as unknown as WebhookProcessor,
      exportProcessor as unknown as ExportProcessor,
      deadLetterProcessor as unknown as DeadLetterProcessor,
    );
  });

  describe('onApplicationShutdown', () => {
    it('should close all workers and then close MongoDB', async () => {
      await service.onApplicationShutdown();

      expect(emailWorker.close).toHaveBeenCalledTimes(1);
      expect(reminderWorker.close).toHaveBeenCalledTimes(1);
      expect(webhookWorker.close).toHaveBeenCalledTimes(1);
      expect(exportWorker.close).toHaveBeenCalledTimes(1);
      expect(deadLetterWorker.close).toHaveBeenCalledTimes(1);

      expect(mongoConnection.close).toHaveBeenCalledTimes(1);
    });

    it('should pass the shutdown signal to the shutdown logger', async () => {
      const loggerLogSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation();

      await service.onApplicationShutdown('SIGTERM');

      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Graceful shutdown started (SIGTERM)',
      );

      expect(loggerLogSpy).toHaveBeenCalledWith('Graceful shutdown completed');

      loggerLogSpy.mockRestore();
    });

    it('should log shutdown without a signal when no signal is provided', async () => {
      const loggerLogSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation();

      await service.onApplicationShutdown();

      expect(loggerLogSpy).toHaveBeenCalledWith('Graceful shutdown started');

      expect(loggerLogSpy).toHaveBeenCalledWith('Graceful shutdown completed');

      loggerLogSpy.mockRestore();
    });

    it('should close workers before MongoDB', async () => {
      const events: string[] = [];

      emailWorker.close.mockImplementation(async () => {
        events.push('email');
      });

      reminderWorker.close.mockImplementation(async () => {
        events.push('reminder');
      });

      webhookWorker.close.mockImplementation(async () => {
        events.push('webhook');
      });

      exportWorker.close.mockImplementation(async () => {
        events.push('export');
      });

      deadLetterWorker.close.mockImplementation(async () => {
        events.push('dead-letter');
      });

      mongoConnection.close.mockImplementation(async () => {
        events.push('mongo');
      });

      await service.onApplicationShutdown();

      expect(events).toEqual([
        'email',
        'reminder',
        'webhook',
        'export',
        'dead-letter',
        'mongo',
      ]);
    });

    it('should close workers sequentially', async () => {
      const events: string[] = [];

      emailWorker.close.mockImplementation(async () => {
        events.push('email-start');
        events.push('email-end');
      });

      reminderWorker.close.mockImplementation(async () => {
        events.push('reminder-start');
        events.push('reminder-end');
      });

      await service.onApplicationShutdown();

      expect(events.indexOf('email-end')).toBeLessThan(
        events.indexOf('reminder-start'),
      );
    });

    it('should continue closing remaining workers if one worker fails', async () => {
      const workerError = new Error('Email worker failed to close');

      emailWorker.close.mockRejectedValue(workerError);

      await expect(service.onApplicationShutdown()).resolves.toBeUndefined();

      expect(emailWorker.close).toHaveBeenCalledTimes(1);
      expect(reminderWorker.close).toHaveBeenCalledTimes(1);
      expect(webhookWorker.close).toHaveBeenCalledTimes(1);
      expect(exportWorker.close).toHaveBeenCalledTimes(1);
      expect(deadLetterWorker.close).toHaveBeenCalledTimes(1);

      expect(mongoConnection.close).toHaveBeenCalledTimes(1);
    });

    it('should continue closing MongoDB even when a worker fails', async () => {
      emailWorker.close.mockRejectedValue(new Error('Worker close failed'));

      await service.onApplicationShutdown();

      expect(mongoConnection.close).toHaveBeenCalledTimes(1);
    });

    it('should log worker close failures', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      emailWorker.close.mockRejectedValue(new Error('Email worker failed'));

      await service.onApplicationShutdown();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to close email queue worker',
        expect.any(String),
      );

      loggerErrorSpy.mockRestore();
    });

    it('should handle non-Error worker failures', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      emailWorker.close.mockRejectedValue('Email worker failed');

      await service.onApplicationShutdown();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to close email queue worker',
        'Email worker failed',
      );

      loggerErrorSpy.mockRestore();
    });
  });

  describe('MongoDB shutdown', () => {
    it('should close MongoDB when the connection is open', async () => {
      mongoConnection.readyState = 1;

      await service.onApplicationShutdown();

      expect(mongoConnection.close).toHaveBeenCalledTimes(1);
    });

    it('should not close MongoDB when the connection is already closed', async () => {
      mongoConnection.readyState = 0;

      await service.onApplicationShutdown();

      expect(mongoConnection.close).not.toHaveBeenCalled();
    });

    it('should close MongoDB when the connection is connecting', async () => {
      mongoConnection.readyState = 2;

      await service.onApplicationShutdown();

      expect(mongoConnection.close).toHaveBeenCalledTimes(1);
    });

    it('should close MongoDB when the connection is disconnecting', async () => {
      mongoConnection.readyState = 3;

      await service.onApplicationShutdown();

      expect(mongoConnection.close).toHaveBeenCalledTimes(1);
    });

    it('should handle MongoDB close failures without throwing', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mongoConnection.close.mockRejectedValue(
        new Error('MongoDB close failed'),
      );

      await expect(service.onApplicationShutdown()).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to close MongoDB connection',
        expect.any(String),
      );

      loggerErrorSpy.mockRestore();
    });

    it('should handle non-Error MongoDB close failures', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mongoConnection.close.mockRejectedValue('MongoDB unavailable');

      await expect(service.onApplicationShutdown()).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to close MongoDB connection',
        'MongoDB unavailable',
      );

      loggerErrorSpy.mockRestore();
    });
  });

  describe('processor worker access', () => {
    it('should obtain the worker from every processor', async () => {
      await service.onApplicationShutdown();

      expect(emailProcessor.getWorker).toHaveBeenCalledTimes(1);
      expect(reminderProcessor.getWorker).toHaveBeenCalledTimes(1);
      expect(webhookProcessor.getWorker).toHaveBeenCalledTimes(1);
      expect(exportProcessor.getWorker).toHaveBeenCalledTimes(1);
      expect(deadLetterProcessor.getWorker).toHaveBeenCalledTimes(1);
    });
  });
});
