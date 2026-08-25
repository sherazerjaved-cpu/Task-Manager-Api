import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import {
  OutboxEvent,
  OutboxEventDocument,
} from '../../schema/outbox-event.schema';

import { IOutboxRepository } from '../../domain/repositories/outbox.repository.interface';
import { OutboxEventStatus } from '../../domain/enums/outbox-event-status.enum';

@Injectable()
export class OutboxRepository implements IOutboxRepository {
  constructor(
    @InjectModel(OutboxEvent.name)
    private readonly outboxModel: Model<OutboxEventDocument>,
  ) {}

  async create(
    data: {
      _id?: Types.ObjectId;
      eventType: string;
      aggregateType: string;
      aggregateId: Types.ObjectId;
      workspaceId?: Types.ObjectId;
      correlationId?: string;
      payload: Record<string, unknown>;
      status?: OutboxEventStatus;
      availableAt?: Date;
    },
    session?: ClientSession,
  ): Promise<OutboxEventDocument> {
    const event = new this.outboxModel({
      ...data,
      status: data.status ?? OutboxEventStatus.PENDING,
    });

    return event.save({ session });
  }

  async findPending(limit: number, now: Date): Promise<OutboxEventDocument[]> {
    return this.outboxModel
      .find({
        status: {
          $in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED],
        },
        $or: [
          { availableAt: { $exists: false } },
          { availableAt: { $lte: now } },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }

  async markProcessing(id: string): Promise<OutboxEventDocument | null> {
    return this.outboxModel.findOneAndUpdate(
      {
        _id: id,
        status: {
          $in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED],
        },
      },
      {
        $set: {
          status: OutboxEventStatus.PROCESSING,
        },
        $inc: {
          attempts: 1,
        },
      },
      {
        new: true,
      },
    );
  }

  async markCompleted(id: string): Promise<OutboxEventDocument | null> {
    return this.outboxModel.findOneAndUpdate(
      {
        _id: id,
        status: OutboxEventStatus.PROCESSING,
      },
      {
        $set: {
          status: OutboxEventStatus.COMPLETED,
          processedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );
  }

  async markFailed(
    id: string,
    error: string,
    availableAt?: Date,
  ): Promise<OutboxEventDocument | null> {
    const event = await this.outboxModel.findById(id);

    if (!event) {
      return null;
    }

    const maxAttempts = 5;

    const update: Record<string, unknown> = {
      lastError: error,
    };

    if (event.attempts >= maxAttempts) {
      update.status = OutboxEventStatus.FAILED;
      update.availableAt = undefined;

      return this.outboxModel.findOneAndUpdate(
        {
          _id: id,
          status: OutboxEventStatus.PROCESSING,
        },
        {
          $set: update,
          $unset: {
            availableAt: 1,
          },
        },
        {
          new: true,
        },
      );
    }

    update.status = OutboxEventStatus.FAILED;

    if (availableAt) {
      update.availableAt = availableAt;
    }

    return this.outboxModel.findOneAndUpdate(
      {
        _id: id,
        status: OutboxEventStatus.PROCESSING,
      },
      {
        $set: update,
      },
      {
        new: true,
      },
    );
  }
}
