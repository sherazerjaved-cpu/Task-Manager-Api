import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';

import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';

export type InvitationDocument = Invitation & Document;

@Schema({
  timestamps: true,
})
export class Invitation {
  @Prop({
    type: Types.ObjectId,
    ref: 'Workspace',
    required: true,
  })
  workspaceId!: Types.ObjectId;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({
    type: String,
    enum: WorkspaceRole,
    required: true,
  })
  role!: WorkspaceRole;

  @Prop({
    required: true,
    select: false,
  })
  tokenHash!: string;

  @Prop({
    required: true,
  })
  expiresAt!: Date;

  @Prop({
    type: String,
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  invitedBy!: Types.ObjectId;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);

InvitationSchema.index({
  workspaceId: 1,
  email: 1,
  status: 1,
});

InvitationSchema.index({
  expiresAt: 1,
});

InvitationSchema.index({
  tokenHash: 1,
});
