import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';
import { TaskPriority } from '../Enums/task-priority.enum';
import { TaskStatus } from '../Enums/task-status.enum';
import mongoose from 'mongoose';

export type TaskDocument = Task & Document;

@Schema({ _id: false })
export class Comment {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  author!: mongoose.Types.ObjectId;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

@Schema({ _id: true })
export class Attachment {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  filename!: string;

  @Prop({ required: true })
  mime!: string;

  @Prop({ required: true })
  size!: number;

  @Prop({ required: true })
  url!: string;
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, minlength: 3 })
  title!: string;

  @Prop()
  description!: string;

  @Prop({ type: String, enum: TaskStatus, default: TaskStatus.Pending })
  status!: TaskStatus;

  @Prop({ type: String, enum: TaskPriority, default: TaskPriority.Medium })
  priority!: TaskPriority;

  @Prop()
  dueDate!: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Category' })
  category?: mongoose.Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ default: null })
  deletedAt?: Date;

  @Prop({ type: Boolean, default: false })
  reminderSent!: boolean;

  @Prop({ type: [CommentSchema], default: [] })
  comments!: Comment[];

  @Prop({ type: [AttachmentSchema], default: [] })
  attachments!: Attachment[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner!: Types.ObjectId;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
