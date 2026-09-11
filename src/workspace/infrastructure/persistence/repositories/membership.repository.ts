import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';
import { Membership, MembershipDocument } from '../schemas/membership.schema';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

@Injectable()
export class MembershipRepository implements IMembershipRepository {
  private readonly membershipCacheKeys = new Set<string>();

  constructor(
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    session?: ClientSession,
  ): Promise<MembershipDocument> {
    try {
      const [membership] = await this.membershipModel.create(
        [
          {
            workspaceId: new Types.ObjectId(workspaceId),
            userId: new Types.ObjectId(userId),
            role,
          },
        ],
        { session },
      );

      await this.clearCache();

      return membership;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(
          'User is already a member of this workspace',
        );
      }

      throw error;
    }
  }

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipDocument | null> {
    const cacheKey = `membership:${workspaceId}:${userId}`;

    const cached = await this.cacheManager.get<MembershipDocument>(cacheKey);

    if (cached) {
      return cached;
    }

    const membership = await this.membershipModel
      .findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (membership) {
      await this.cacheManager.set(cacheKey, membership, 30 * 1000);
      this.membershipCacheKeys.add(cacheKey);
    }

    return membership;
  }

  async findByUser(userId: string): Promise<MembershipDocument[]> {
    const cacheKey = `memberships:user:${userId}`;

    const cached = await this.cacheManager.get<MembershipDocument[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const memberships = await this.membershipModel
      .find({
        userId: new Types.ObjectId(userId),
      })
      .exec();

    await this.cacheManager.set(cacheKey, memberships, 30 * 1000);
    this.membershipCacheKeys.add(cacheKey);

    return memberships;
  }

  async findByWorkspace(workspaceId: string): Promise<MembershipDocument[]> {
    const cacheKey = `memberships:workspace:${workspaceId}`;

    const cached = await this.cacheManager.get<MembershipDocument[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const memberships = await this.membershipModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .exec();

    await this.cacheManager.set(cacheKey, memberships, 30 * 1000);
    this.membershipCacheKeys.add(cacheKey);

    return memberships;
  }

  async exists(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.membershipModel.exists({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
    });

    return !!membership;
  }

  private async clearCache(): Promise<void> {
    for (const key of this.membershipCacheKeys) {
      await this.cacheManager.del(key);
    }

    this.membershipCacheKeys.clear();
  }
}
