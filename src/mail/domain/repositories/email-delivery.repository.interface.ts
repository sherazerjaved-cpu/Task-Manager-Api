import { Types } from 'mongoose';

import { EmailDeliveryDocument } from 'src/mail/schema/email-delivery.schema';
import { EmailDeliveryStatus } from '../enums/email-delivery-status.enum';

export interface CreateEmailDeliveryData {
  outboxEventId: Types.ObjectId;
  to: string;
  emailType: string;
  status?: EmailDeliveryStatus;
  attempts?: number;
  providerMessageId?: string;
  lastError?: string;
  sentAt?: Date;
  failedAt?: Date;
}

export interface IEmailDeliveryRepository {
  create(data: CreateEmailDeliveryData): Promise<EmailDeliveryDocument>;

  findByOutboxEventId(
    outboxEventId: Types.ObjectId,
  ): Promise<EmailDeliveryDocument | null>;

  update(
    id: string,
    data: Partial<CreateEmailDeliveryData>,
  ): Promise<EmailDeliveryDocument | null>;
}
