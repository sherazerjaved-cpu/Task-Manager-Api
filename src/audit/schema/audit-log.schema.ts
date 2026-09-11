import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  actorId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  action!: string;

  @Prop({ required: true })
  resource!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Workspace',
    required: false,
    index: true,
  })
  workspaceId?: Types.ObjectId;

  @Prop({ required: false })
  ip?: string;

  @Prop({ type: Object, required: false })
  meta?: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.pre(/^findOneAnd(Update|Delete|Replace)$/, function () {
  throw new Error('Audit logs are immutable');
});

AuditLogSchema.pre(/^(update|replace)/, function () {
  throw new Error('Audit logs are immutable');
});

AuditLogSchema.pre(/^delete/, function () {
  throw new Error('Audit logs are immutable');
});
