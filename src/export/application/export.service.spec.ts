import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { access } from 'fs/promises';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import type { IExportRepository } from 'src/export/domain/repositories/export.repository.interface';
import { ExportService } from './export.service';
import { ExportStatus } from 'src/export/domain/enums/export-status.enum';
import { WorkspaceFeatureFlag } from 'src/workspace/domain/enums/workspace-feature-flag.enum';
import { OutboxService } from 'src/outbox/application/outbox.service';
import { ExportDownloadTokenService } from 'src/export/application/export-download-token.service';
import { FeatureFlagsService } from 'src/workspace/application/services/feature-flags.service';
import { Connection } from 'mongoose';

jest.mock('fs/promises', () => ({
  ...jest.requireActual<typeof import('fs/promises')>('fs/promises'),
  access: jest.fn(),
}));

type ExportFormat = 'json' | 'csv' | 'xlsx';

interface ExportRequestData {
  workspaceId: string;
  userId: string;
  format: ExportFormat;
}

interface GenerateExportData extends ExportRequestData {
  outboxEventId: string;
}

interface ExportRecord {
  _id: Types.ObjectId | string;
  workspaceId: string;
  userId: string;
  format: ExportFormat;
  status: ExportStatus;
  filePath?: string;
  fileName?: string;
  expiresAt?: Date;
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TaskRepositoryMock {
  findAllForExport: jest.MockedFunction<
    (workspaceId: string) => Promise<unknown[]>
  >;
}

interface OutboxServiceMock {
  create: jest.MockedFunction<
    (
      data: {
        id: string;
        eventType: string;
        aggregateType: string;
        aggregateId: string;
        workspaceId: string;
        payload: {
          exportId: string;
          outboxEventId: string;
          workspaceId: string;
          userId: string;
          format: ExportFormat;
        };
      },
      session: unknown,
    ) => Promise<unknown>
  >;
}

interface ExportRepositoryMock {
  create: jest.MockedFunction<
    (
      data: {
        id: string;
        outboxEventId: string;
        workspaceId: string;
        userId: string;
        format: ExportFormat;
        status: ExportStatus;
      },
      session: unknown,
    ) => Promise<ExportRecord>
  >;

  findByOutboxEventId: jest.MockedFunction<
    (outboxEventId: string) => Promise<ExportRecord | null>
  >;

  findById: jest.MockedFunction<
    (exportId: string) => Promise<ExportRecord | null>
  >;

  update: jest.MockedFunction<
    (exportId: string, data: Partial<ExportRecord>) => Promise<unknown>
  >;
}

interface ExportDownloadTokenServiceMock {
  generateToken: jest.MockedFunction<
    (data: { exportId: string; userId: string; expiresAt: Date }) => string
  >;

  verifyToken: jest.MockedFunction<
    (token: string) => {
      exportId: string;
      userId: string;
      expiresAt: number;
    }
  >;
}

interface FeatureFlagsServiceMock {
  isEnabled: jest.MockedFunction<
    (workspaceId: string, featureFlag: WorkspaceFeatureFlag) => Promise<boolean>
  >;
}

interface SessionMock {
  withTransaction: jest.MockedFunction<
    (callback: (session: SessionMock) => Promise<unknown>) => Promise<unknown>
  >;

  endSession: jest.MockedFunction<() => Promise<void>>;
}

interface ConnectionMock {
  startSession: jest.MockedFunction<() => Promise<SessionMock>>;
}

describe('ExportService', () => {
  let service: ExportService;

  let taskRepository: TaskRepositoryMock;
  let outboxService: OutboxServiceMock;
  let exportRepository: ExportRepositoryMock;
  let exportDownloadTokenService: ExportDownloadTokenServiceMock;
  let featureFlagsService: FeatureFlagsServiceMock;
  let connection: ConnectionMock;
  let session: SessionMock;

  const mockedAccess = access as jest.MockedFunction<typeof access>;

  beforeEach(() => {
    taskRepository = {
      findAllForExport: jest.fn(),
    };

    outboxService = {
      create: jest.fn(),
    };

    exportRepository = {
      create: jest.fn(),
      findByOutboxEventId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    exportDownloadTokenService = {
      generateToken: jest.fn(),
      verifyToken: jest.fn(),
    };

    featureFlagsService = {
      isEnabled: jest.fn(),
    };

    session = {
      withTransaction: jest.fn(),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    connection = {
      startSession: jest.fn().mockResolvedValue(session),
    };

    service = new ExportService(
      taskRepository as unknown as ITaskRepository,
      outboxService as unknown as OutboxService,
      exportRepository as unknown as IExportRepository,
      exportDownloadTokenService as unknown as ExportDownloadTokenService,
      featureFlagsService as unknown as FeatureFlagsService,
      connection as unknown as Connection,
    );

    jest.clearAllMocks();

    mockedAccess.mockResolvedValue(undefined);
  });

  // ===========================================================================
  // requestExport
  // ===========================================================================

  describe('requestExport', () => {
    const data: ExportRequestData = {
      workspaceId: 'workspace-123',
      userId: 'user-123',
      format: 'json',
    };

    const createExportRecord = (
      overrides: Partial<ExportRecord> = {},
    ): ExportRecord => ({
      _id: new Types.ObjectId(),
      workspaceId: data.workspaceId,
      userId: data.userId,
      format: data.format,
      status: ExportStatus.QUEUED,
      ...overrides,
    });

    const setupSuccessfulTransaction = (): void => {
      session.withTransaction.mockImplementation(
        async (callback: (session: SessionMock) => Promise<unknown>) =>
          callback(session),
      );
    };

    it('should reject export when EXPORTS feature flag is disabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);

      await expect(service.requestExport(data)).rejects.toThrow(
        new ForbiddenException('Data exports are disabled for this workspace'),
      );

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        data.workspaceId,
        WorkspaceFeatureFlag.EXPORTS,
      );

      expect(connection.startSession).not.toHaveBeenCalled();
      expect(exportRepository.create).not.toHaveBeenCalled();
      expect(outboxService.create).not.toHaveBeenCalled();
    });

    it('should allow export when EXPORTS feature flag is enabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      const exportRecord = createExportRecord();

      exportRepository.create.mockResolvedValue(exportRecord);

      setupSuccessfulTransaction();

      const result = await service.requestExport(data);

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        data.workspaceId,
        WorkspaceFeatureFlag.EXPORTS,
      );

      expect(connection.startSession).toHaveBeenCalledTimes(1);
      expect(exportRepository.create).toHaveBeenCalledTimes(1);
      expect(outboxService.create).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        message: 'Export requested successfully',
        exportId: exportRecord._id.toString(),
        exportEventId: expect.any(String),
        status: ExportStatus.QUEUED,
      });

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should create the export record with QUEUED status', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      const exportRecord = createExportRecord();

      exportRepository.create.mockResolvedValue(exportRecord);

      setupSuccessfulTransaction();

      await service.requestExport(data);

      expect(exportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          outboxEventId: expect.any(String),
          workspaceId: data.workspaceId,
          userId: data.userId,
          format: data.format,
          status: ExportStatus.QUEUED,
        }),
        session,
      );
    });

    it('should create the EXPORT_REQUESTED outbox event', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      const exportRecord = createExportRecord();

      exportRepository.create.mockResolvedValue(exportRecord);

      setupSuccessfulTransaction();

      await service.requestExport(data);

      expect(outboxService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          eventType: 'EXPORT_REQUESTED',
          aggregateType: 'WORKSPACE',
          aggregateId: data.workspaceId,
          workspaceId: data.workspaceId,
          payload: expect.objectContaining({
            exportId: expect.any(String),
            outboxEventId: expect.any(String),
            workspaceId: data.workspaceId,
            userId: data.userId,
            format: data.format,
          }),
        }),
        session,
      );
    });

    it('should end the session after successful transaction', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      exportRepository.create.mockResolvedValue(createExportRecord());

      setupSuccessfulTransaction();

      await service.requestExport(data);

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should end the session when the transaction fails', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      session.withTransaction.mockRejectedValue(
        new Error('Transaction failed'),
      );

      await expect(service.requestExport(data)).rejects.toThrow(
        'Transaction failed',
      );

      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should propagate an export repository creation error', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      session.withTransaction.mockImplementation(
        async (callback: (session: SessionMock) => Promise<unknown>) =>
          callback(session),
      );

      exportRepository.create.mockRejectedValue(
        new Error('Export creation failed'),
      );

      await expect(service.requestExport(data)).rejects.toThrow(
        'Export creation failed',
      );

      expect(outboxService.create).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('should propagate an outbox creation error', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);

      session.withTransaction.mockImplementation(
        async (callback: (session: SessionMock) => Promise<unknown>) =>
          callback(session),
      );

      exportRepository.create.mockResolvedValue(createExportRecord());

      outboxService.create.mockRejectedValue(
        new Error('Outbox creation failed'),
      );

      await expect(service.requestExport(data)).rejects.toThrow(
        'Outbox creation failed',
      );

      expect(exportRepository.create).toHaveBeenCalledTimes(1);
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // generateExport
  // ===========================================================================

  describe('generateExport', () => {
    const data: GenerateExportData = {
      workspaceId: 'workspace-123',
      userId: 'user-123',
      format: 'json',
      outboxEventId: 'outbox-123',
    };

    const exportRecord: ExportRecord = {
      _id: new Types.ObjectId(),
      workspaceId: data.workspaceId,
      userId: data.userId,
      format: data.format,
      status: ExportStatus.QUEUED,
    };

    beforeEach(() => {
      exportRepository.findByOutboxEventId.mockResolvedValue(exportRecord);

      exportRepository.update.mockResolvedValue(undefined);

      taskRepository.findAllForExport.mockResolvedValue([]);
    });

    it('should throw when export record does not exist', async () => {
      exportRepository.findByOutboxEventId.mockResolvedValue(null);

      await expect(service.generateExport(data)).rejects.toThrow(
        `Export record not found for outbox event ${data.outboxEventId}`,
      );

      expect(exportRepository.update).not.toHaveBeenCalled();
      expect(taskRepository.findAllForExport).not.toHaveBeenCalled();
    });

    it('should mark export as PROCESSING before generating', async () => {
      await service.generateExport(data);

      expect(exportRepository.update).toHaveBeenCalledWith(
        exportRecord._id.toString(),
        expect.objectContaining({
          status: ExportStatus.PROCESSING,
          error: undefined,
        }),
      );
    });

    it('should retrieve tasks for the correct workspace', async () => {
      await service.generateExport(data);

      expect(taskRepository.findAllForExport).toHaveBeenCalledWith(
        data.workspaceId,
      );
    });

    it('should complete the export successfully', async () => {
      await service.generateExport(data);

      const completedCall = exportRepository.update.mock.calls.find(
        ([, update]) => update.status === ExportStatus.COMPLETED,
      );

      expect(completedCall).toBeDefined();

      expect(completedCall?.[1]).toEqual(
        expect.objectContaining({
          status: ExportStatus.COMPLETED,
          filePath: expect.any(String),
          fileName: expect.any(String),
          expiresAt: expect.any(Date),
          error: undefined,
        }),
      );
    });

    it('should generate CSV export', async () => {
      const csvData: GenerateExportData = {
        ...data,
        format: 'csv',
      };

      await service.generateExport(csvData);

      const completedCall = exportRepository.update.mock.calls.find(
        ([, update]) => update.status === ExportStatus.COMPLETED,
      );

      expect(completedCall).toBeDefined();

      expect(completedCall?.[1].fileName).toMatch(/\.csv$/);
    });

    it('should generate XLSX export', async () => {
      const xlsxData: GenerateExportData = {
        ...data,
        format: 'xlsx',
      };

      await service.generateExport(xlsxData);

      const completedCall = exportRepository.update.mock.calls.find(
        ([, update]) => update.status === ExportStatus.COMPLETED,
      );

      expect(completedCall).toBeDefined();

      expect(completedCall?.[1].fileName).toMatch(/\.xlsx$/);
    });

    it('should export tasks containing CSV special characters', async () => {
      taskRepository.findAllForExport.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          title: 'Task, with comma',
          description: 'Description with "quotes"',
          status: 'pending',
          priority: 'high',
          workspace: data.workspaceId,
          owner: data.userId,
          dueDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const csvData: GenerateExportData = {
        ...data,
        format: 'csv',
      };

      await service.generateExport(csvData);

      const completedCall = exportRepository.update.mock.calls.find(
        ([, update]) => update.status === ExportStatus.COMPLETED,
      );

      expect(completedCall).toBeDefined();
      expect(completedCall?.[1].fileName).toMatch(/\.csv$/);
    });

    it('should export tasks containing nested XLSX values', async () => {
      taskRepository.findAllForExport.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          title: 'Task',
          description: 'Description',
          status: 'pending',
          priority: 'medium',
          workspace: new Types.ObjectId(),
          owner: new Types.ObjectId(),
          dueDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const xlsxData: GenerateExportData = {
        ...data,
        format: 'xlsx',
      };

      await service.generateExport(xlsxData);

      const completedCall = exportRepository.update.mock.calls.find(
        ([, update]) => update.status === ExportStatus.COMPLETED,
      );

      expect(completedCall).toBeDefined();
      expect(completedCall?.[1].fileName).toMatch(/\.xlsx$/);
    });

    it('should throw for an unsupported export format', async () => {
      const invalidData: GenerateExportData = {
        ...data,
        format: 'json',
      };

      Object.defineProperty(invalidData, 'format', {
        value: 'xml',
        writable: true,
      });

      await expect(service.generateExport(invalidData)).rejects.toThrow(
        'Unsupported export format: xml',
      );
    });

    it('should mark export as PROCESSING before generation fails', async () => {
      taskRepository.findAllForExport.mockRejectedValue(
        new Error('Task repository failed'),
      );

      await expect(service.generateExport(data)).rejects.toThrow(
        'Task repository failed',
      );

      expect(exportRepository.update).toHaveBeenCalledWith(
        exportRecord._id.toString(),
        expect.objectContaining({
          status: ExportStatus.PROCESSING,
          error: undefined,
        }),
      );
    });

    it('should rethrow generation errors', async () => {
      taskRepository.findAllForExport.mockRejectedValue(
        new Error('Task repository failed'),
      );

      await expect(service.generateExport(data)).rejects.toThrow(
        'Task repository failed',
      );
    });

    it('should propagate errors from the initial PROCESSING update', async () => {
      exportRepository.update.mockRejectedValueOnce(
        new Error('Processing update failed'),
      );

      await expect(service.generateExport(data)).rejects.toThrow(
        'Processing update failed',
      );

      expect(taskRepository.findAllForExport).not.toHaveBeenCalled();
    });

    it('should propagate errors from the COMPLETED update', async () => {
      exportRepository.update
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Completed update failed'));

      await expect(service.generateExport(data)).rejects.toThrow(
        'Completed update failed',
      );

      expect(taskRepository.findAllForExport).toHaveBeenCalledWith(
        data.workspaceId,
      );
    });
  });

  // ===========================================================================
  // getExport
  // ===========================================================================

  describe('getExport', () => {
    const exportId = 'export-123';
    const workspaceId = 'workspace-123';
    const userId = 'user-123';

    it('should throw when export does not exist', async () => {
      exportRepository.findById.mockResolvedValue(null);

      await expect(
        service.getExport(exportId, workspaceId, userId),
      ).rejects.toThrow(new NotFoundException('Export not found'));
    });

    it('should reject access to another workspace export', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId: 'different-workspace',
        userId,
        format: 'json',
        status: ExportStatus.QUEUED,
      });

      await expect(
        service.getExport(exportId, workspaceId, userId),
      ).rejects.toThrow(
        new ForbiddenException('You do not have access to this export'),
      );
    });

    it('should reject access to another user export', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId: 'different-user',
        format: 'json',
        status: ExportStatus.QUEUED,
      });

      await expect(
        service.getExport(exportId, workspaceId, userId),
      ).rejects.toThrow(
        new ForbiddenException('You do not have access to this export'),
      );
    });

    it('should return a queued export without a download URL', async () => {
      const createdAt = new Date();
      const updatedAt = new Date();

      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.QUEUED,
        createdAt,
        updatedAt,
      });

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(result.downloadUrl).toBeNull();
      expect(result.status).toBe(ExportStatus.QUEUED);
      expect(result.createdAt).toBe(createdAt);
      expect(result.updatedAt).toBe(updatedAt);

      expect(exportDownloadTokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should generate a download URL for a completed export', async () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.COMPLETED,
        filePath: '/exports/tasks.json',
        fileName: 'tasks.json',
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      exportDownloadTokenService.generateToken.mockReturnValue(
        'download-token',
      );

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(exportDownloadTokenService.generateToken).toHaveBeenCalledWith({
        exportId,
        userId,
        expiresAt,
      });

      expect(result.downloadUrl).toContain('download?token=');
      expect(result.downloadUrl).toContain(
        encodeURIComponent('download-token'),
      );
    });

    it('should not generate a download URL when completed export has no expiry', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.COMPLETED,
        filePath: '/exports/tasks.json',
        fileName: 'tasks.json',
        expiresAt: undefined,
      });

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(result.downloadUrl).toBeNull();

      expect(exportDownloadTokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should not generate a download URL when completed export has no file path', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        filePath: undefined,
        fileName: 'tasks.json',
        status: ExportStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(result.downloadUrl).toBeNull();

      expect(exportDownloadTokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should not generate a download URL when export has no file name', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        filePath: '/exports/tasks.json',
        fileName: undefined,
        status: ExportStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(result.downloadUrl).toBeNull();

      expect(exportDownloadTokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should not generate a download URL when export is completed but status condition is not satisfied', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.PROCESSING,
        filePath: '/exports/tasks.json',
        fileName: 'tasks.json',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(result.downloadUrl).toBeNull();

      expect(exportDownloadTokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should not generate a download URL when completed export is expired', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.COMPLETED,
        filePath: '/exports/tasks.json',
        fileName: 'tasks.json',
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(result.downloadUrl).toBeNull();

      expect(exportDownloadTokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should return export error when an error exists', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.QUEUED,
        error: 'Export failed',
      });

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(result.error).toBe('Export failed');
    });

    it('should return null when export error is undefined', async () => {
      exportRepository.findById.mockResolvedValue({
        _id: exportId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.QUEUED,
        error: undefined,
      });

      const result = await service.getExport(exportId, workspaceId, userId);

      expect(result.error).toBeNull();
    });
  });

  // ===========================================================================
  // downloadExport
  // ===========================================================================

  describe('downloadExport', () => {
    const exportId = 'export-123';
    const workspaceId = 'workspace-123';
    const userId = 'user-123';
    const token = 'download-token';

    const createCompletedExport = (): ExportRecord => ({
      _id: exportId,
      workspaceId,
      userId,
      format: 'json',
      status: ExportStatus.COMPLETED,
      filePath: '/tmp/export.json',
      fileName: 'export.json',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    beforeEach(() => {
      exportDownloadTokenService.verifyToken.mockReturnValue({
        exportId,
        userId,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      exportRepository.findById.mockResolvedValue(createCompletedExport());

      mockedAccess.mockResolvedValue(undefined);
    });

    it('should reject an invalid token', async () => {
      exportDownloadTokenService.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid or expired download token'),
      );

      expect(exportRepository.findById).not.toHaveBeenCalled();
    });

    it('should reject a token for a different export', async () => {
      exportDownloadTokenService.verifyToken.mockReturnValue({
        exportId: 'different-export',
        userId,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(new UnauthorizedException('Invalid download token'));

      expect(exportRepository.findById).not.toHaveBeenCalled();
    });

    it('should reject a token belonging to another user', async () => {
      exportDownloadTokenService.verifyToken.mockReturnValue({
        exportId,
        userId: 'different-user',
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new ForbiddenException('You do not have access to this export'),
      );

      expect(exportRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw when export does not exist', async () => {
      exportRepository.findById.mockResolvedValue(null);

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(new NotFoundException('Export not found'));
    });

    it('should reject access to another workspace', async () => {
      exportRepository.findById.mockResolvedValue({
        ...createCompletedExport(),
        workspaceId: 'different-workspace',
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new ForbiddenException('You do not have access to this export'),
      );

      expect(mockedAccess).not.toHaveBeenCalled();
    });

    it('should reject access to another user', async () => {
      exportRepository.findById.mockResolvedValue({
        ...createCompletedExport(),
        userId: 'different-user',
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new ForbiddenException('You do not have access to this export'),
      );

      expect(mockedAccess).not.toHaveBeenCalled();
    });

    it('should reject an export that is not completed', async () => {
      exportRepository.findById.mockResolvedValue({
        ...createCompletedExport(),
        status: ExportStatus.PROCESSING,
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new BadRequestException('Export is not ready for download'),
      );

      expect(mockedAccess).not.toHaveBeenCalled();
    });

    it('should reject when file path is missing', async () => {
      exportRepository.findById.mockResolvedValue({
        ...createCompletedExport(),
        filePath: undefined,
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(new NotFoundException('Export file not found'));

      expect(mockedAccess).not.toHaveBeenCalled();
    });

    it('should reject when file name is missing', async () => {
      exportRepository.findById.mockResolvedValue({
        ...createCompletedExport(),
        fileName: undefined,
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(new NotFoundException('Export file not found'));

      expect(mockedAccess).not.toHaveBeenCalled();
    });

    it('should reject when expiry date is missing', async () => {
      exportRepository.findById.mockResolvedValue({
        ...createCompletedExport(),
        expiresAt: undefined,
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new UnauthorizedException('Export download has expired'),
      );

      expect(mockedAccess).not.toHaveBeenCalled();
    });

    it('should reject an expired export', async () => {
      exportRepository.findById.mockResolvedValue({
        ...createCompletedExport(),
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new UnauthorizedException('Export download has expired'),
      );

      expect(mockedAccess).not.toHaveBeenCalled();
    });

    it('should reject when the export file is no longer available', async () => {
      mockedAccess.mockRejectedValue(new Error('File does not exist'));

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new NotFoundException('Export file is no longer available'),
      );

      expect(mockedAccess).toHaveBeenCalledWith(
        '/tmp/export.json',
        expect.any(Number),
      );
    });

    it('should return file information when the export file is accessible', async () => {
      mockedAccess.mockResolvedValue(undefined);

      const result = await service.downloadExport(
        exportId,
        workspaceId,
        userId,
        token,
      );

      expect(result).toEqual({
        filePath: '/tmp/export.json',
        fileName: 'export.json',
      });

      expect(mockedAccess).toHaveBeenCalledWith(
        '/tmp/export.json',
        expect.any(Number),
      );
    });

    it('should perform the file access check before returning the file', async () => {
      mockedAccess.mockResolvedValue(undefined);

      await service.downloadExport(exportId, workspaceId, userId, token);

      expect(mockedAccess).toHaveBeenCalledTimes(1);
    });

    it('should reject when the export expires during processing', async () => {
      const expiresAt = new Date(Date.now() + 1000);

      exportRepository.findById.mockResolvedValue({
        ...createCompletedExport(),
        expiresAt,
      });

      mockedAccess.mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 1100);
        });
      });

      await expect(
        service.downloadExport(exportId, workspaceId, userId, token),
      ).rejects.toThrow(
        new UnauthorizedException('Export download has expired'),
      );
    });
  });
});
