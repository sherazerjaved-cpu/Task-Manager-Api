import { Types } from 'mongoose';

import { WebhookDeliveryDocument } from 'src/webhook/schema/webhook-delivery.schema';

import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';

export interface CreateWebhookDeliveryData {
  webhookId: Types.ObjectId;
  outboxEventId: Types.ObjectId;
  eventType: string;
  attempt: number;
  status?: WebhookDeliveryStatus;
  responseStatus?: number;
  error?: string;
  durationMs?: number;
  deliveredAt?: Date;
}

export interface IWebhookDeliveryRepository {
  create(data: CreateWebhookDeliveryData): Promise<WebhookDeliveryDocument>;

  findSuccessfulDelivery(
    webhookId: Types.ObjectId,
    outboxEventId: Types.ObjectId,
  ): Promise<WebhookDeliveryDocument | null>;

  update(
    id: string,
    data: Partial<CreateWebhookDeliveryData>,
  ): Promise<WebhookDeliveryDocument | null>;
}
