import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';

import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

import { MembershipStatus } from '../../../domain/enums/membership-status.enum';

export type MembershipDocument = Membership & Document;

@Schema({
  timestamps: true,
})
export class Membership {
  @Prop({
    type: Types.ObjectId,
    ref: 'Workspace',
    required: true,
  })
  workspaceId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: WorkspaceRole,
    required: true,
  })
  role!: WorkspaceRole;

  @Prop({
    type: String,
    enum: MembershipStatus,
    default: MembershipStatus.ACTIVE,
  })
  status!: MembershipStatus;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

MembershipSchema.index(
  {
    workspaceId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);
