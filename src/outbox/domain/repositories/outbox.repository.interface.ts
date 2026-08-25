import { ClientSession, Types } from 'mongoose';
import { OutboxEventDocument } from '../../schema/outbox-event.schema';
import { OutboxEventStatus } from '../enums/outbox-event-status.enum';

export interface IOutboxRepository {
  create(
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
  ): Promise<OutboxEventDocument>;

  findPending(limit: number, now: Date): Promise<OutboxEventDocument[]>;

  markProcessing(id: string): Promise<OutboxEventDocument | null>;

  markCompleted(id: string): Promise<OutboxEventDocument | null>;

  markFailed(
    id: string,
    error: string,
    availableAt?: Date,
  ): Promise<OutboxEventDocument | null>;
}
