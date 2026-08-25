import { ExportRepository } from './export.repository';
import { ExportStatus } from 'src/export/domain/enums/export-status.enum';
import { Types } from 'mongoose';

describe('ExportRepository', () => {
  let repository: ExportRepository;

  let exportModel: {
    create: jest.Mock;
    findById: jest.Mock;
    findOne: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  beforeEach(() => {
    exportModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    repository = new ExportRepository(exportModel as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an export with the supplied id', async () => {
      const exportRecord = {
        _id: 'export-123',
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'csv',
        status: ExportStatus.QUEUED,
      };

      exportModel.create.mockResolvedValue([exportRecord]);

      const data = {
        id: 'export-123',
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'csv' as const,
        status: ExportStatus.QUEUED,
        outboxEventId: 'outbox-123',
      };

      const result = await repository.create(data);

      expect(exportModel.create).toHaveBeenCalledTimes(1);

      expect(exportModel.create).toHaveBeenCalledWith(
        [
          {
            _id: 'export-123',
            workspaceId: 'workspace-123',
            userId: 'user-123',
            format: 'csv',
            status: ExportStatus.QUEUED,
            outboxEventId: 'outbox-123',
          },
        ],
        {
          session: undefined,
        },
      );

      expect(result).toBe(exportRecord);
    });

    it('should omit _id when id is not provided', async () => {
      const exportRecord = {
        _id: 'generated-id',
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'json',
        status: ExportStatus.QUEUED,
      };

      exportModel.create.mockResolvedValue([exportRecord]);

      const data = {
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'json' as const,
        outboxEventId: 'outbox-123',
      };

      const result = await repository.create(data);

      expect(exportModel.create).toHaveBeenCalledWith(
        [
          {
            workspaceId: 'workspace-123',
            userId: 'user-123',
            format: 'json',
            status: ExportStatus.QUEUED,
            outboxEventId: 'outbox-123',
          },
        ],
        {
          session: undefined,
        },
      );

      expect(result).toBe(exportRecord);
    });

    it('should default status to QUEUED when status is not provided', async () => {
      exportModel.create.mockResolvedValue([
        {
          _id: 'export-123',
        },
      ]);

      await repository.create({
        id: 'export-123',
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'xlsx',
        outboxEventId: 'outbox-123',
      });

      expect(exportModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            _id: 'export-123',
            status: ExportStatus.QUEUED,
            outboxEventId: 'outbox-123',
          }),
        ],
        {
          session: undefined,
        },
      );
    });

    it('should preserve an explicitly provided status', async () => {
      exportModel.create.mockResolvedValue([
        {
          _id: 'export-123',
          status: ExportStatus.PROCESSING,
        },
      ]);

      await repository.create({
        id: 'export-123',
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'csv',
        status: ExportStatus.PROCESSING,
        outboxEventId: 'outbox-123',
      });

      expect(exportModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            _id: 'export-123',
            status: ExportStatus.PROCESSING,
            outboxEventId: 'outbox-123',
          }),
        ],
        {
          session: undefined,
        },
      );
    });

    it('should pass the MongoDB session to create', async () => {
      const session = {
        id: 'session-123',
      } as any;

      exportModel.create.mockResolvedValue([
        {
          _id: 'export-123',
        },
      ]);

      await repository.create(
        {
          id: 'export-123',
          workspaceId: 'workspace-123',
          userId: 'user-123',
          format: 'csv',
          outboxEventId: 'outbox-123',
        },
        session,
      );

      expect(exportModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            _id: 'export-123',
            outboxEventId: 'outbox-123',
          }),
        ],
        {
          session,
        },
      );
    });

    it('should return the first created export record', async () => {
      const firstRecord = {
        _id: 'export-123',
      };

      const secondRecord = {
        _id: 'export-456',
      };

      exportModel.create.mockResolvedValue([firstRecord, secondRecord]);

      const result = await repository.create({
        id: 'export-123',
        workspaceId: 'workspace-123',
        userId: 'user-123',
        format: 'csv',
        outboxEventId: 'outbox-123',
      });

      expect(result).toBe(firstRecord);
    });
  });

  describe('findById', () => {
    it('should find an export by id', async () => {
      const exportId = new Types.ObjectId().toString();

      const exportRecord = {
        _id: exportId,
        workspaceId: 'workspace-123',
      };

      const exec = jest.fn().mockResolvedValue(exportRecord);

      exportModel.findById.mockReturnValue({
        exec,
      });

      const result = await repository.findById(exportId);

      expect(exportModel.findById).toHaveBeenCalledTimes(1);
      expect(exportModel.findById).toHaveBeenCalledWith(exportId);
      expect(exec).toHaveBeenCalledTimes(1);
      expect(result).toBe(exportRecord);
    });

    it('should return null when the export does not exist', async () => {
      const exportId = new Types.ObjectId().toString();

      const exec = jest.fn().mockResolvedValue(null);

      exportModel.findById.mockReturnValue({
        exec,
      });

      const result = await repository.findById(exportId);

      expect(result).toBeNull();

      expect(exportModel.findById).toHaveBeenCalledWith(exportId);
    });
  });

  describe('findByOutboxEventId', () => {
    it('should find an export by outbox event id', async () => {
      const exportRecord = {
        _id: 'export-123',
        outboxEventId: 'outbox-123',
      };

      const exec = jest.fn().mockResolvedValue(exportRecord);

      exportModel.findOne.mockReturnValue({
        exec,
      });

      const result = await repository.findByOutboxEventId('outbox-123');

      expect(exportModel.findOne).toHaveBeenCalledTimes(1);

      expect(exportModel.findOne).toHaveBeenCalledWith({
        outboxEventId: 'outbox-123',
      });

      expect(exec).toHaveBeenCalledTimes(1);
      expect(result).toBe(exportRecord);
    });

    it('should return null when the outbox event does not exist', async () => {
      const exec = jest.fn().mockResolvedValue(null);

      exportModel.findOne.mockReturnValue({
        exec,
      });

      const result = await repository.findByOutboxEventId('missing-outbox');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an export and return the updated record', async () => {
      const updatedRecord = {
        _id: 'export-123',
        status: ExportStatus.COMPLETED,
        fileName: 'tasks.csv',
      };

      const exec = jest.fn().mockResolvedValue(updatedRecord);

      exportModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const updateData = {
        status: ExportStatus.COMPLETED,
        fileName: 'tasks.csv',
      };

      const result = await repository.update('export-123', updateData);

      expect(exportModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);

      expect(exportModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'export-123',
        {
          $set: updateData,
        },
        {
          new: true,
        },
      );

      expect(exec).toHaveBeenCalledTimes(1);
      expect(result).toBe(updatedRecord);
    });

    it('should return null when the export does not exist', async () => {
      const exec = jest.fn().mockResolvedValue(null);

      exportModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.update('missing-export', {
        status: ExportStatus.COMPLETED,
      });

      expect(result).toBeNull();
    });

    it('should update only the supplied fields', async () => {
      const exec = jest.fn().mockResolvedValue({
        _id: 'export-123',
      });

      exportModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const updateData = {
        error: 'Export failed',
      };

      await repository.update('export-123', updateData);

      expect(exportModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'export-123',
        {
          $set: {
            error: 'Export failed',
          },
        },
        {
          new: true,
        },
      );
    });
  });

  describe('error propagation', () => {
    it('should propagate create errors', async () => {
      const error = new Error('Database create failed');

      exportModel.create.mockRejectedValue(error);

      await expect(
        repository.create({
          id: 'export-123',
          workspaceId: 'workspace-123',
          userId: 'user-123',
          format: 'csv',
          outboxEventId: 'outbox-123',
        }),
      ).rejects.toBe(error);
    });

    it('should propagate findById errors', async () => {
      const exportId = new Types.ObjectId().toString();
      const error = new Error('Database query failed');

      exportModel.findById.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findById(exportId)).rejects.toBe(error);
    });

    it('should propagate findByOutboxEventId errors', async () => {
      const error = new Error('Database query failed');

      exportModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findByOutboxEventId('outbox-123')).rejects.toBe(
        error,
      );
    });

    it('should propagate update errors', async () => {
      const error = new Error('Database update failed');

      exportModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(
        repository.update('export-123', {
          status: ExportStatus.COMPLETED,
        }),
      ).rejects.toBe(error);
    });
  });
});
