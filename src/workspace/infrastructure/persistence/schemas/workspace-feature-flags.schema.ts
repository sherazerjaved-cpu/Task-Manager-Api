import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { WorkspaceFeatureFlag } from '../../../domain/enums/workspace-feature-flag.enum';

export type WorkspaceFeatureFlagsDocument = WorkspaceFeatureFlags &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({
  timestamps: true,
  collection: 'workspace_feature_flags',
})
export class WorkspaceFeatureFlags {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true,
  })
  workspaceId!: Types.ObjectId;

  @Prop({
    type: Map,
    of: Boolean,
    default: {},
  })
  flags!: Map<WorkspaceFeatureFlag, boolean>;
}

export const WorkspaceFeatureFlagsSchema = SchemaFactory.createForClass(
  WorkspaceFeatureFlags,
);
