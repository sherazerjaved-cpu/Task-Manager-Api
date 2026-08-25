import {
  ForbiddenException,
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { constants } from 'fs';
import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import { OutboxService } from 'src/outbox/application/outbox.service';
import { ExportDocument } from 'src/export/infrastructure/database/schemas/export.schema';
import { EXPORT_REPOSITORY } from 'src/export/domain/constants/repository.tokens';
import type { IExportRepository } from 'src/export/domain/repositories/export.repository.interface';
import { ExportDownloadTokenService } from './export-download-token.service';
import { ExportStatus } from 'src/export/domain/enums/export-status.enum';
import { Types } from 'mongoose';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { FeatureFlagsService } from 'src/workspace/application/services/feature-flags.service';
import { WorkspaceFeatureFlag } from 'src/workspace/domain/enums/workspace-feature-flag.enum';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    private readonly outboxService: OutboxService,

    @Inject(EXPORT_REPOSITORY)
    private readonly exportRepository: IExportRepository,

    private readonly exportDownloadTokenService: ExportDownloadTokenService,

    private readonly featureFlagsService: FeatureFlagsService,

    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async requestExport(data: {
    workspaceId: string;
    userId: string;
    format: 'json' | 'csv' | 'xlsx';
  }) {
    const enabled = await this.featureFlagsService.isEnabled(
      data.workspaceId,
      WorkspaceFeatureFlag.EXPORTS,
    );

    if (!enabled) {
      throw new ForbiddenException(
        'Data exports are disabled for this workspace',
      );
    }
    const exportId = new Types.ObjectId().toString();

    const outboxEventId = new Types.ObjectId().toString();

    const session = await this.connection.startSession();

    let exportRecord: ExportDocument;

    try {
      exportRecord = await session.withTransaction(async () => {
        const createdExport = await this.exportRepository.create(
          {
            id: exportId,
            outboxEventId,
            workspaceId: data.workspaceId,
            userId: data.userId,
            format: data.format,
            status: ExportStatus.QUEUED,
          },
          session,
        );

        await this.outboxService.create(
          {
            id: outboxEventId,
            eventType: 'EXPORT_REQUESTED',
            aggregateType: 'WORKSPACE',
            aggregateId: data.workspaceId,
            workspaceId: data.workspaceId,
            payload: {
              exportId,
              outboxEventId,
              workspaceId: data.workspaceId,
              userId: data.userId,
              format: data.format,
            },
          },
          session,
        );

        return createdExport;
      });
    } finally {
      await session.endSession();
    }

    this.logger.log(`Export requested: ${exportRecord._id.toString()}`);

    return {
      message: 'Export requested successfully',
      exportId: exportRecord._id.toString(),
      exportEventId: outboxEventId,
      status: ExportStatus.QUEUED,
    };
  }

  async generateExport(data: {
    workspaceId: string;
    userId: string;
    format: 'json' | 'csv' | 'xlsx';
    outboxEventId: string;
  }): Promise<void> {
    this.logger.log(
      `Generating ${data.format} export for workspace ${data.workspaceId}`,
    );

    const exportRecord = await this.exportRepository.findByOutboxEventId(
      data.outboxEventId,
    );

    if (!exportRecord) {
      throw new Error(
        `Export record not found for outbox event ${data.outboxEventId}`,
      );
    }

    await this.exportRepository.update(exportRecord._id.toString(), {
      status: ExportStatus.PROCESSING,
      error: undefined,
    });

    try {
      const tasks = await this.taskRepository.findAllForExport(
        data.workspaceId,
      );

      let result: {
        filePath: string;
        fileName: string;
      };

      if (data.format === 'json') {
        result = await this.generateJsonExport(tasks, data.workspaceId);
      } else if (data.format === 'csv') {
        result = await this.generateCsvExport(tasks, data.workspaceId);
      } else if (data.format === 'xlsx') {
        result = await this.generateXlsxExport(tasks, data.workspaceId);
      } else {
        throw new Error(`Unsupported export format: ${data.format as string}`);
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await this.exportRepository.update(exportRecord._id.toString(), {
        status: ExportStatus.COMPLETED,
        filePath: result.filePath,
        fileName: result.fileName,
        expiresAt,
        error: undefined,
      });

      this.logger.log(`Export completed: ${exportRecord._id.toString()}`);
    } catch (error) {
      this.logger.error(
        `Export generation attempt failed: ${exportRecord._id.toString()}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async generateJsonExport(
    tasks: any[],
    workspaceId: string,
  ): Promise<{
    filePath: string;
    fileName: string;
  }> {
    const exportDirectory = join(process.cwd(), 'exports');

    await mkdir(exportDirectory, {
      recursive: true,
    });

    const filename = `tasks-${workspaceId}-${Date.now()}.json`;

    const filePath = join(exportDirectory, filename);

    const json = JSON.stringify(tasks, null, 2);

    await writeFile(filePath, json, 'utf-8');

    this.logger.log(`JSON export created: ${filePath}`);

    return {
      filePath,
      fileName: filename,
    };
  }

  private async generateCsvExport(
    tasks: any[],
    workspaceId: string,
  ): Promise<{
    filePath: string;
    fileName: string;
  }> {
    const exportDirectory = join(process.cwd(), 'exports');

    await mkdir(exportDirectory, {
      recursive: true,
    });

    const filename = `tasks-${workspaceId}-${Date.now()}.csv`;

    const filePath = join(exportDirectory, filename);

    const headers = [
      'id',
      'title',
      'description',
      'status',
      'priority',
      'workspace',
      'owner',
      'dueDate',
      'createdAt',
      'updatedAt',
    ];

    const escapeCsv = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }

      let stringValue: string;

      switch (typeof value) {
        case 'string':
          stringValue = value;
          break;

        case 'number':
        case 'boolean':
        case 'bigint':
          stringValue = value.toString();
          break;

        case 'object':
          stringValue = JSON.stringify(value) ?? '';
          break;

        default:
          stringValue = '';
      }

      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const rows = tasks.map((task) => [
      task._id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.workspace,
      task.owner,
      task.dueDate,
      task.createdAt,
      task.updatedAt,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    await writeFile(filePath, csv, 'utf-8');

    this.logger.log(`CSV export created: ${filePath}`);

    return {
      filePath,
      fileName: filename,
    };
  }

  private async generateXlsxExport(
    tasks: any[],
    workspaceId: string,
  ): Promise<{
    filePath: string;
    fileName: string;
  }> {
    const exportDirectory = join(process.cwd(), 'exports');

    await mkdir(exportDirectory, {
      recursive: true,
    });

    const filename = `tasks-${workspaceId}-${Date.now()}.xlsx`;

    const filePath = join(exportDirectory, filename);

    const rows = tasks.map((task) => ({
      id: task._id?.toString(),
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      workspace: task.workspace?.toString(),
      owner: task.owner?.toString(),
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

    XLSX.writeFile(workbook, filePath);

    this.logger.log(`XLSX export created: ${filePath}`);

    return {
      filePath,
      fileName: filename,
    };
  }

  async getExport(exportId: string, workspaceId: string, userId: string) {
    const exportRecord = await this.exportRepository.findById(exportId);

    if (!exportRecord) {
      throw new NotFoundException('Export not found');
    }

    if (exportRecord.workspaceId !== workspaceId) {
      throw new ForbiddenException('You do not have access to this export');
    }

    if (exportRecord.userId !== userId) {
      throw new ForbiddenException('You do not have access to this export');
    }

    let downloadUrl: string | null = null;

    if (
      exportRecord.status === ExportStatus.COMPLETED &&
      exportRecord.expiresAt &&
      exportRecord.filePath &&
      exportRecord.fileName &&
      Date.now() < exportRecord.expiresAt.getTime()
    ) {
      const expiresAt = exportRecord.expiresAt;

      const token = this.exportDownloadTokenService.generateToken({
        exportId: exportRecord._id.toString(),
        userId,
        expiresAt,
      });

      downloadUrl = `/api/v1/workspaces/${workspaceId}/exports/${exportRecord._id.toString()}/download?token=${encodeURIComponent(token)}`;
    }

    return {
      exportId: exportRecord._id.toString(),
      workspaceId: exportRecord.workspaceId,
      format: exportRecord.format,
      status: exportRecord.status,
      fileName: exportRecord.fileName ?? null,
      expiresAt: exportRecord.expiresAt ?? null,
      downloadUrl,
      error: exportRecord.error ?? null,
      createdAt: exportRecord.createdAt,
      updatedAt: exportRecord.updatedAt,
    };
  }
  async downloadExport(
    exportId: string,
    workspaceId: string,
    userId: string,
    token: string,
  ) {
    let tokenPayload: {
      exportId: string;
      userId: string;
      expiresAt: number;
    };

    try {
      tokenPayload = this.exportDownloadTokenService.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired download token');
    }

    if (tokenPayload.exportId !== exportId) {
      throw new UnauthorizedException('Invalid download token');
    }

    if (tokenPayload.userId !== userId) {
      throw new ForbiddenException('You do not have access to this export');
    }

    const exportRecord = await this.exportRepository.findById(exportId);

    if (!exportRecord) {
      throw new NotFoundException('Export not found');
    }

    if (exportRecord.workspaceId !== workspaceId) {
      throw new ForbiddenException('You do not have access to this export');
    }

    if (exportRecord.userId !== userId) {
      throw new ForbiddenException('You do not have access to this export');
    }

    if (exportRecord.status !== ExportStatus.COMPLETED) {
      throw new BadRequestException('Export is not ready for download');
    }

    if (!exportRecord.filePath || !exportRecord.fileName) {
      throw new NotFoundException('Export file not found');
    }

    if (
      !exportRecord.expiresAt ||
      Date.now() >= exportRecord.expiresAt.getTime()
    ) {
      throw new UnauthorizedException('Export download has expired');
    }

    try {
      await access(exportRecord.filePath, constants.R_OK);
    } catch {
      throw new NotFoundException('Export file is no longer available');
    }

    if (
      !exportRecord.expiresAt ||
      Date.now() >= exportRecord.expiresAt.getTime()
    ) {
      throw new UnauthorizedException('Export download has expired');
    }

    return {
      filePath: exportRecord.filePath,
      fileName: exportRecord.fileName,
    };
  }
}
