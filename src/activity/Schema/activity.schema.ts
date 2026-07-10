import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityDocument = Activity & Document;

@Schema({ timestamps: true })
export class Activity {

  @Prop({type: Types.ObjectId, ref: 'Task', required: true})
  task!: Types.ObjectId;

  @Prop({type: Types.ObjectId, ref: 'User', required: true})
  user!: Types.ObjectId;

  @Prop({required: true})
  action!: string;

  @Prop()
  description?: string;

  @Prop({ type: Object })
  changes?: Record<string, any>;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);