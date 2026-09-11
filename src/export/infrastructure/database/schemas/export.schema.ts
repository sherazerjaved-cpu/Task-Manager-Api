import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { ExportStatus } from 'src/export/domain/enums/export-status.enum';

export type ExportDocument = Export & Document;

@Schema({
  timestamps: true,
})
export class Export {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  outboxEventId!: string;

  @Prop({
    required: true,
    index: true,
  })
  workspaceId!: string;

  @Prop({
    required: true,
    index: true,
  })
  userId!: string;

  @Prop({
    required: true,
    enum: ['json', 'csv', 'xlsx'],
  })
  format!: 'json' | 'csv' | 'xlsx';

  @Prop({
    type: String,
    required: true,
    enum: ExportStatus,
    default: ExportStatus.QUEUED,
    index: true,
  })
  status!: ExportStatus;

  @Prop()
  filePath?: string;

  @Prop()
  fileName?: string;

  @Prop()
  expiresAt?: Date;

  @Prop()
  error?: string;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ExportSchema = SchemaFactory.createForClass(Export);

ExportSchema.index({
  workspaceId: 1,
  createdAt: -1,
});

ExportSchema.index({
  userId: 1,
  createdAt: -1,
});
