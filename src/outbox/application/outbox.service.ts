import { Inject, Injectable } from '@nestjs/common';
import { ClientSession, Types } from 'mongoose';

import { OUTBOX_REPOSITORY } from '../domain/constants/repository.tokens';
import type { IOutboxRepository } from '../domain/repositories/outbox.repository.interface';
import { RequestContextService } from 'src/common/http/request-context.service';

@Injectable()
export class OutboxService {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: IOutboxRepository,

    private readonly requestContextService: RequestContextService,
  ) {}

  async create(
    data: {
      id?: string;
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      workspaceId?: string;
      payload: Record<string, unknown>;
    },
    session?: ClientSession,
  ) {
    const correlationId = this.requestContextService.getRequestId();

    return this.outboxRepository.create(
      {
        ...(data.id
          ? {
              _id: new Types.ObjectId(data.id),
            }
          : {}),

        eventType: data.eventType,

        aggregateType: data.aggregateType,

        aggregateId: new Types.ObjectId(data.aggregateId),

        workspaceId: data.workspaceId
          ? new Types.ObjectId(data.workspaceId)
          : undefined,

        correlationId,

        payload: data.payload,
      },
      session,
    );
  }

  async findPending(limit: number, now: Date) {
    return this.outboxRepository.findPending(limit, now);
  }

  async markProcessing(id: string) {
    return this.outboxRepository.markProcessing(id);
  }

  async markCompleted(id: string) {
    return this.outboxRepository.markCompleted(id);
  }

  async markFailed(id: string, error: string, availableAt?: Date) {
    return this.outboxRepository.markFailed(id, error, availableAt);
  }
}
