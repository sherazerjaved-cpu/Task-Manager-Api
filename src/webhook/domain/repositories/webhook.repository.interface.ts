import { Types } from 'mongoose';
import { WebhookDocument } from 'src/webhook/schema/webhook.schema';

export interface IWebhookRepository {
  create(data: {
    workspaceId: Types.ObjectId;
    url: string;
    secret: string;
    events: string[];
  }): Promise<WebhookDocument>;

  findByWorkspace(workspaceId: Types.ObjectId): Promise<WebhookDocument[]>;

  findActiveByWorkspace(
    workspaceId: Types.ObjectId,
    eventType: string,
  ): Promise<WebhookDocument[]>;

  findById(id: string): Promise<WebhookDocument | null>;

  delete(id: string): Promise<WebhookDocument | null>;
}
