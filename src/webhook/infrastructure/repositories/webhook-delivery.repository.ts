import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WebhookDelivery,
  WebhookDeliveryDocument,
} from 'src/webhook/schema/webhook-delivery.schema';
import {
  CreateWebhookDeliveryData,
  IWebhookDeliveryRepository,
} from 'src/webhook/domain/repositories/webhook-delivery.repository.interface';

import { WebhookDeliveryStatus } from 'src/webhook/domain/enums/webhook-delivery-status.enum';

@Injectable()
export class WebhookDeliveryRepository implements IWebhookDeliveryRepository {
  constructor(
    @InjectModel(WebhookDelivery.name)
    private readonly webhookDeliveryModel: Model<WebhookDeliveryDocument>,
  ) {}

  async create(
    data: CreateWebhookDeliveryData,
  ): Promise<WebhookDeliveryDocument> {
    return this.webhookDeliveryModel.create({
      ...data,
      status: data.status ?? WebhookDeliveryStatus.PENDING,
    });
  }

  async findSuccessfulDelivery(
    webhookId: Types.ObjectId,
    outboxEventId: Types.ObjectId,
  ): Promise<WebhookDeliveryDocument | null> {
    return this.webhookDeliveryModel
      .findOne({
        webhookId,
        outboxEventId,
        status: WebhookDeliveryStatus.SUCCESS,
      })
      .exec();
  }

  async update(
    id: string,
    data: Partial<CreateWebhookDeliveryData>,
  ): Promise<WebhookDeliveryDocument | null> {
    return this.webhookDeliveryModel
      .findByIdAndUpdate(
        id,
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
