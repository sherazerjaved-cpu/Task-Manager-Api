import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { Webhook, WebhookDocument } from '../../schema/webhook.schema';
import type { IWebhookRepository } from 'src/webhook/domain/repositories/webhook.repository.interface';

@Injectable()
export class WebhookRepository implements IWebhookRepository {
  constructor(
    @InjectModel(Webhook.name)
    private readonly webhookModel: Model<WebhookDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(data: {
    workspaceId: Types.ObjectId;
    url: string;
    secret: string;
    events: string[];
  }): Promise<WebhookDocument> {
    const webhook = await this.webhookModel.create(data);

    await this.cacheManager.del(
      `webhooks:workspace:${data.workspaceId.toString()}`,
    );

    return webhook;
  }

  async findByWorkspace(
    workspaceId: Types.ObjectId,
  ): Promise<WebhookDocument[]> {
    const cacheKey = `webhooks:workspace:${workspaceId.toString()}`;

    const cached = await this.cacheManager.get<WebhookDocument[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const webhooks = await this.webhookModel.find({ workspaceId }).exec();

    await this.cacheManager.set(cacheKey, webhooks, 60 * 1000);

    return webhooks;
  }

  async findActiveByWorkspace(
    workspaceId: Types.ObjectId,
    eventType: string,
  ): Promise<WebhookDocument[]> {
    return this.webhookModel
      .find({
        workspaceId,
        active: true,
        events: eventType,
      })
      .select('+secret')
      .exec();
  }

  async findById(id: string): Promise<WebhookDocument | null> {
    return this.webhookModel.findById(id).exec();
  }

  async delete(id: string): Promise<WebhookDocument | null> {
    const webhook = await this.webhookModel.findByIdAndDelete(id).exec();

    if (webhook) {
      await this.cacheManager.del(
        `webhooks:workspace:${webhook.workspaceId.toString()}`,
      );
    }

    return webhook;
  }
}
