import { Response } from 'express';

import { ExportController } from './export.controller';
import { ExportService } from '../application/export.service';

describe('ExportController', () => {
  let controller: ExportController;

  let exportService: {
    requestExport: jest.Mock;
    getExport: jest.Mock;
    downloadExport: jest.Mock;
  };

  let request: any;
  let response: any;

  beforeEach(() => {
    exportService = {
      requestExport: jest.fn(),
      getExport: jest.fn(),
      downloadExport: jest.fn(),
    };

    controller = new ExportController(
      exportService as unknown as ExportService,
    );

    request = {
      user: {
        userId: 'user-123',
      },
    };

    response = {
      download: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createExport', () => {
    it('should request a workspace export', async () => {
      const result = {
        message: 'Export requested successfully',
        exportId: 'export-123',
        exportEventId: 'outbox-123',
        status: 'QUEUED',
      };

      exportService.requestExport.mockResolvedValue(result);

      const dto = {
        format: 'csv' as const,
      };

      await expect(
        controller.createExport('workspace-123', dto, request),
      ).resolves.toEqual(result);

      expect(exportService.requestExport).toHaveBeenCalledTimes(1);

      expect(exportService.requestExport).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'csv',
      });
    });

    it('should use the authenticated user id', async () => {
      exportService.requestExport.mockResolvedValue({
        exportId: 'export-123',
      });

      request.user = {
        userId: 'authenticated-user',
      };

      await controller.createExport(
        'workspace-456',
        {
          format: 'json',
        },
        request,
      );

      expect(exportService.requestExport).toHaveBeenCalledWith({
        workspaceId: 'workspace-456',
        userId: 'authenticated-user',
        format: 'json',
      });
    });

    it('should support xlsx exports', async () => {
      exportService.requestExport.mockResolvedValue({
        exportId: 'export-123',
      });

      await controller.createExport(
        'workspace-123',
        {
          format: 'xlsx',
        },
        request,
      );

      expect(exportService.requestExport).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'xlsx',
      });
    });

    it('should return the service result', async () => {
      const serviceResult = {
        message: 'Export requested successfully',
        exportId: 'export-123',
        exportEventId: 'outbox-123',
        status: 'QUEUED',
      };

      exportService.requestExport.mockResolvedValue(serviceResult);

      const result = await controller.createExport(
        'workspace-123',
        {
          format: 'csv',
        },
        request,
      );

      expect(result).toBe(serviceResult);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Export request failed');

      exportService.requestExport.mockRejectedValue(error);

      await expect(
        controller.createExport(
          'workspace-123',
          {
            format: 'csv',
          },
          request,
        ),
      ).rejects.toBe(error);
    });
  });

  describe('getExport', () => {
    it('should get an export by id', async () => {
      const exportResult = {
        exportId: 'export-123',
        workspaceId: 'workspace-123',
        format: 'csv',
        status: 'COMPLETED',
        fileName: 'tasks.csv',
        downloadUrl: '/download',
      };

      exportService.getExport.mockResolvedValue(exportResult);

      const result = await controller.getExport(
        'workspace-123',
        'export-123',
        request,
      );

      expect(result).toBe(exportResult);

      expect(exportService.getExport).toHaveBeenCalledTimes(1);

      expect(exportService.getExport).toHaveBeenCalledWith(
        'export-123',
        'workspace-123',
        'user-123',
      );
    });

    it('should use the authenticated user id', async () => {
      exportService.getExport.mockResolvedValue({
        exportId: 'export-123',
      });

      request.user = {
        userId: 'user-456',
      };

      await controller.getExport('workspace-123', 'export-123', request);

      expect(exportService.getExport).toHaveBeenCalledWith(
        'export-123',
        'workspace-123',
        'user-456',
      );
    });

    it('should pass the correct workspace and export ids', async () => {
      exportService.getExport.mockResolvedValue({
        exportId: 'export-999',
      });

      await controller.getExport('workspace-999', 'export-999', request);

      expect(exportService.getExport).toHaveBeenCalledWith(
        'export-999',
        'workspace-999',
        'user-123',
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('Export not found');

      exportService.getExport.mockRejectedValue(error);

      await expect(
        controller.getExport('workspace-123', 'export-123', request),
      ).rejects.toBe(error);
    });
  });

  describe('downloadExport', () => {
    it('should download the export file', async () => {
      const serviceResult = {
        filePath: '/exports/tasks-workspace-123.csv',
        fileName: 'tasks.csv',
      };

      exportService.downloadExport.mockResolvedValue(serviceResult);

      await controller.downloadExport(
        'workspace-123',
        'export-123',
        'valid-token',
        request,
        response as Response,
      );

      expect(exportService.downloadExport).toHaveBeenCalledTimes(1);

      expect(exportService.downloadExport).toHaveBeenCalledWith(
        'export-123',
        'workspace-123',
        'user-123',
        'valid-token',
      );

      expect(response.download).toHaveBeenCalledTimes(1);

      expect(response.download).toHaveBeenCalledWith(
        '/exports/tasks-workspace-123.csv',
        'tasks.csv',
      );
    });

    it('should pass the download token to the service', async () => {
      exportService.downloadExport.mockResolvedValue({
        filePath: '/exports/tasks.csv',
        fileName: 'tasks.csv',
      });

      await controller.downloadExport(
        'workspace-123',
        'export-123',
        'token-abc-123',
        request,
        response as Response,
      );

      expect(exportService.downloadExport).toHaveBeenCalledWith(
        'export-123',
        'workspace-123',
        'user-123',
        'token-abc-123',
      );
    });

    it('should use the authenticated user id', async () => {
      exportService.downloadExport.mockResolvedValue({
        filePath: '/exports/tasks.csv',
        fileName: 'tasks.csv',
      });

      request.user = {
        userId: 'different-user',
      };

      await controller.downloadExport(
        'workspace-123',
        'export-123',
        'valid-token',
        request,
        response as Response,
      );

      expect(exportService.downloadExport).toHaveBeenCalledWith(
        'export-123',
        'workspace-123',
        'different-user',
        'valid-token',
      );
    });

    it('should use the file path returned by the service', async () => {
      exportService.downloadExport.mockResolvedValue({
        filePath: 'C:/exports/generated-file.xlsx',
        fileName: 'my-export.xlsx',
      });

      await controller.downloadExport(
        'workspace-123',
        'export-123',
        'token',
        request,
        response as Response,
      );

      expect(response.download).toHaveBeenCalledWith(
        'C:/exports/generated-file.xlsx',
        'my-export.xlsx',
      );
    });

    it('should return the result of response.download', async () => {
      const downloadResult = {
        sent: true,
      };

      response.download.mockReturnValue(downloadResult);

      exportService.downloadExport.mockResolvedValue({
        filePath: '/exports/tasks.csv',
        fileName: 'tasks.csv',
      });

      const result = await controller.downloadExport(
        'workspace-123',
        'export-123',
        'token',
        request,
        response as Response,
      );

      expect(result).toBe(downloadResult);
    });

    it('should not download the file when the service fails', async () => {
      const error = new Error('Invalid download token');

      exportService.downloadExport.mockRejectedValue(error);

      await expect(
        controller.downloadExport(
          'workspace-123',
          'export-123',
          'invalid-token',
          request,
          response as Response,
        ),
      ).rejects.toBe(error);

      expect(response.download).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      const error = new Error('Export file not found');

      exportService.downloadExport.mockRejectedValue(error);

      await expect(
        controller.downloadExport(
          'workspace-123',
          'export-123',
          'token',
          request,
          response as Response,
        ),
      ).rejects.toBe(error);

      expect(response.download).not.toHaveBeenCalled();
    });
  });
});
