import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ProcessedEventDocument = ProcessedEvent & Document;

@Schema({ timestamps: true })
export class ProcessedEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId!: string;

  @Prop({ required: true })
  eventType!: string;
}

export const ProcessedEventSchema =
  SchemaFactory.createForClass(ProcessedEvent);
