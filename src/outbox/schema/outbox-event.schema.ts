import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OutboxEventStatus } from '../domain/enums/outbox-event-status.enum';

export type OutboxEventDocument = OutboxEvent & Document;

@Schema({ timestamps: true })
export class OutboxEvent {
  @Prop({ required: true, index: true })
  eventType!: string;

  @Prop({ required: true, index: true })
  aggregateType!: string;

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  aggregateId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    index: true,
  })
  workspaceId?: Types.ObjectId;

  @Prop({ type: String, index: true })
  correlationId?: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({
    type: String,
    enum: OutboxEventStatus,
    default: OutboxEventStatus.PENDING,
    index: true,
  })
  status!: OutboxEventStatus;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop()
  availableAt?: Date;

  @Prop()
  processedAt?: Date;

  @Prop()
  lastError?: string;
}

export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEvent);

OutboxEventSchema.index({
  status: 1,
  availableAt: 1,
  createdAt: 1,
});
