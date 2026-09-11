import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  WorkspaceFeatureFlags,
  WorkspaceFeatureFlagsDocument,
} from '../schemas/workspace-feature-flags.schema';

import { WorkspaceFeatureFlagsRepository } from '../../../domain/repositories/workspace-feature-flags.repository.interface';
import { WorkspaceFeatureFlagsEntity } from '../../../domain/entities/workspace-feature-flags.entity';
import { WorkspaceFeatureFlag } from '../../../domain/enums/workspace-feature-flag.enum';

@Injectable()
export class MongooseWorkspaceFeatureFlagsRepository implements WorkspaceFeatureFlagsRepository {
  constructor(
    @InjectModel(WorkspaceFeatureFlags.name)
    private readonly model: Model<WorkspaceFeatureFlagsDocument>,
  ) {}

  async findByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceFeatureFlagsEntity | null> {
    const document = await this.model
      .findOne({
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .lean()
      .exec();

    if (!document) {
      return null;
    }

    return this.toEntity(document);
  }

  async create(
    entity: WorkspaceFeatureFlagsEntity,
  ): Promise<WorkspaceFeatureFlagsEntity> {
    const document = await this.model.create({
      workspaceId: new Types.ObjectId(entity.workspaceId),
      flags: entity.flags,
    });

    return this.toEntity(document);
  }

  async update(
    workspaceId: string,
    flags: Partial<Record<WorkspaceFeatureFlag, boolean>>,
  ): Promise<WorkspaceFeatureFlagsEntity> {
    const document = await this.model
      .findOneAndUpdate(
        {
          workspaceId: new Types.ObjectId(workspaceId),
        },
        {
          $set: Object.fromEntries(
            Object.entries(flags).map(([key, value]) => [
              `flags.${key}`,
              value,
            ]),
          ),
        },
        {
          new: true,
          upsert: false,
        },
      )
      .lean()
      .exec();

    if (!document) {
      throw new Error(`Feature flags not found for workspace ${workspaceId}`);
    }

    return this.toEntity(document);
  }

  private toEntity(
    document: WorkspaceFeatureFlagsDocument,
  ): WorkspaceFeatureFlagsEntity {
    const flags =
      document.flags instanceof Map
        ? Object.fromEntries(document.flags.entries())
        : (document.flags ?? {});

    return new WorkspaceFeatureFlagsEntity(
      document.workspaceId.toString(),
      flags as Record<WorkspaceFeatureFlag, boolean>,
      document.createdAt,
      document.updatedAt,
    );
  }
}
