import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  ProcessedEvent,
  ProcessedEventDocument,
} from '../../schema/processed-event.schema';
import { IProcessedEventRepository } from '../../domain/repositories/processed-event.repository.interface';

@Injectable()
export class ProcessedEventRepository implements IProcessedEventRepository {
  constructor(
    @InjectModel(ProcessedEvent.name)
    private readonly processedEventModel: Model<ProcessedEventDocument>,
  ) {}

  async hasBeenProcessed(eventId: string): Promise<boolean> {
    const event = await this.processedEventModel.exists({
      eventId,
    });

    return !!event;
  }

  async markProcessed(eventId: string, eventType: string): Promise<void> {
    await this.processedEventModel.create({
      eventId,
      eventType,
    });
  }
}
