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

  @Prop({ default: null })
  tokenFamily?: string;

  @Prop({ select: false, default: null })
  currentTokenId?: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ select: false, default: null })
  emailVerificationTokenHash?: string;

  @Prop({ select: false, default: null })
  emailVerificationExpiresAt?: Date;

  @Prop({ select: false, default: null })
  passwordResetTokenHash?: string;

  @Prop({ select: false, default: null })
  passwordResetExpiresAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
