import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true, select: false })
  password!: string;

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role!: string;

  @Prop({ select: false, default: null })
  refreshTokenHash?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
