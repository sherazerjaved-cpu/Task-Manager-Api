import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WebhookDocument = Webhook & Document;

@Schema({ timestamps: true })
export class Webhook {
  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  workspaceId!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
  })
  url!: string;

  @Prop({
    required: true,
    select: false,
  })
  secret!: string;

  @Prop({
    required: true,
    default: true,
  })
  active!: boolean;

  @Prop({
    type: [String],
    default: [],
  })
  events!: string[];
}

export const WebhookSchema = SchemaFactory.createForClass(Webhook);

WebhookSchema.index({
  workspaceId: 1,
  url: 1,
});
