import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  EmailDelivery,
  EmailDeliveryDocument,
} from 'src/mail/schema/email-delivery.schema';

import {
  CreateEmailDeliveryData,
  IEmailDeliveryRepository,
} from 'src/mail/domain/repositories/email-delivery.repository.interface';

import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

@Injectable()
export class EmailDeliveryRepository implements IEmailDeliveryRepository {
  constructor(
    @InjectModel(EmailDelivery.name)
    private readonly emailDeliveryModel: Model<EmailDeliveryDocument>,
  ) {}

  async create(data: CreateEmailDeliveryData): Promise<EmailDeliveryDocument> {
    return this.emailDeliveryModel.create({
      ...data,
      status: data.status ?? EmailDeliveryStatus.QUEUED,
      attempts: data.attempts ?? 0,
    });
  }

  async findByOutboxEventId(
    outboxEventId: Types.ObjectId,
  ): Promise<EmailDeliveryDocument | null> {
    return this.emailDeliveryModel
      .findOne({
        outboxEventId,
      })
      .exec();
  }

  async update(
    id: string,
    data: Partial<CreateEmailDeliveryData>,
  ): Promise<EmailDeliveryDocument | null> {
    return this.emailDeliveryModel
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
