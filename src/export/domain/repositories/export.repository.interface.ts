import { ExportDocument } from 'src/export/infrastructure/database/schemas/export.schema';
import { ExportStatus } from '../enums/export-status.enum';
import { ClientSession } from 'mongoose';

export interface CreateExportData {
  id?: string;
  outboxEventId: string;
  workspaceId: string;
  userId: string;
  format: 'json' | 'csv' | 'xlsx';
  status?: ExportStatus;
}

export interface UpdateExportData {
  status?: ExportStatus;
  filePath?: string;
  fileName?: string;
  expiresAt?: Date;
  error?: string;
}

export interface IExportRepository {
  create(
    data: CreateExportData,
    session?: ClientSession,
  ): Promise<ExportDocument>;

  findById(exportId: string): Promise<ExportDocument | null>;

  findByOutboxEventId(outboxEventId: string): Promise<ExportDocument | null>;

  update(
    exportId: string,
    data: UpdateExportData,
  ): Promise<ExportDocument | null>;
}
