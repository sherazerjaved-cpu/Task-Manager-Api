import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { EmailDeliveryStatus } from '../domain/enums/email-delivery-status.enum';

export type EmailDeliveryDocument = EmailDelivery & Document;

@Schema({
  timestamps: true,
})
export class EmailDelivery {
  @Prop({
    type: Types.ObjectId,
    required: true,
    unique: true,
    index: true,
  })
  outboxEventId!: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
  })
  to!: string;

  @Prop({
    required: true,
    index: true,
  })
  emailType!: string;

  @Prop({
    type: String,
    required: true,
    enum: EmailDeliveryStatus,
    default: EmailDeliveryStatus.QUEUED,
    index: true,
  })
  status!: EmailDeliveryStatus;

  @Prop()
  attempts?: number;

  @Prop()
  providerMessageId?: string;

  @Prop()
  lastError?: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  failedAt?: Date;
}

export const EmailDeliverySchema = SchemaFactory.createForClass(EmailDelivery);

EmailDeliverySchema.index({
  to: 1,
  createdAt: -1,
});

EmailDeliverySchema.index({
  status: 1,
  createdAt: -1,
});
