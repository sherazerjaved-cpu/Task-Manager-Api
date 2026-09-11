import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { Export, ExportDocument } from '../schemas/export.schema';
import { Types } from 'mongoose';
import {
  CreateExportData,
  IExportRepository,
  UpdateExportData,
} from 'src/export/domain/repositories/export.repository.interface';

import { ExportStatus } from 'src/export/domain/enums/export-status.enum';

@Injectable()
export class ExportRepository implements IExportRepository {
  constructor(
    @InjectModel(Export.name)
    private readonly exportModel: Model<ExportDocument>,
  ) {}

  async create(
    data: CreateExportData,
    session?: ClientSession,
  ): Promise<ExportDocument> {
    const { id, ...exportData } = data;

    const [exportRecord] = await this.exportModel.create(
      [
        {
          ...(id ? { _id: id } : {}),
          ...exportData,
          status: data.status ?? ExportStatus.QUEUED,
        },
      ],
      { session },
    );

    return exportRecord;
  }

  async findById(exportId: string): Promise<ExportDocument | null> {
    if (!Types.ObjectId.isValid(exportId)) {
      return null;
    }
    return this.exportModel.findById(exportId).exec();
  }

  async findByOutboxEventId(
    outboxEventId: string,
  ): Promise<ExportDocument | null> {
    return this.exportModel
      .findOne({
        outboxEventId,
      })
      .exec();
  }

  async update(
    exportId: string,
    data: UpdateExportData,
  ): Promise<ExportDocument | null> {
    return this.exportModel
      .findByIdAndUpdate(
        exportId,
        {
          $set: data,
        },
        {
          new: true,
        },
      )
      .exec();
  }
}
