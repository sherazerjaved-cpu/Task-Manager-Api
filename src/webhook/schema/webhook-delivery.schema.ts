import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { WebhookDeliveryStatus } from '../domain/enums/webhook-delivery-status.enum';

export type WebhookDeliveryDocument = WebhookDelivery & Document;

@Schema({
  timestamps: true,
})
export class WebhookDelivery {
  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  webhookId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  outboxEventId!: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
  })
  eventType!: string;

  @Prop({
    required: true,
  })
  attempt!: number;

  @Prop({
    type: String,
    required: true,
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.PENDING,
    index: true,
  })
  status!: WebhookDeliveryStatus;

  @Prop()
  responseStatus?: number;

  @Prop()
  error?: string;

  @Prop()
  durationMs?: number;

  @Prop()
  deliveredAt?: Date;
}

export const WebhookDeliverySchema =
  SchemaFactory.createForClass(WebhookDelivery);

WebhookDeliverySchema.index({
  webhookId: 1,
  createdAt: -1,
});

WebhookDeliverySchema.index({
  outboxEventId: 1,
  webhookId: 1,
  attempt: 1,
});
