import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { IInvitationRepository } from '../../../domain/repositories/invitation.repository.interface';
import { Invitation, InvitationDocument } from '../schemas/invitation.schema';
import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

@Injectable()
export class InvitationRepository implements IInvitationRepository {
  private readonly invitationCacheKeys = new Set<string>();

  constructor(
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    tokenHash: string,
    expiresAt: Date,
    invitedBy: string,
  ): Promise<InvitationDocument> {
    const invitation = await this.invitationModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      email: email.toLowerCase(),
      role,
      tokenHash,
      expiresAt,
      invitedBy: new Types.ObjectId(invitedBy),
    });

    await this.clearCache();

    return invitation;
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationDocument | null> {
    return this.invitationModel
      .findOne({
        tokenHash,
      })
      .select('+tokenHash')
      .exec();
  }

  async findPendingByEmail(email: string): Promise<InvitationDocument[]> {
    const normalizedEmail = email.toLowerCase();

    const cacheKey = `invitations:pending:email:${normalizedEmail}`;

    const cached = await this.cacheManager.get<InvitationDocument[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const invitations = await this.invitationModel
      .find({
        email: normalizedEmail,
        status: InvitationStatus.PENDING,
      })
      .exec();

    await this.cacheManager.set(cacheKey, invitations, 30 * 1000);
    this.invitationCacheKeys.add(cacheKey);

    return invitations;
  }

  async findPendingByWorkspace(
    workspaceId: string,
  ): Promise<InvitationDocument[]> {
    const cacheKey = `invitations:pending:workspace:${workspaceId}`;

    const cached = await this.cacheManager.get<InvitationDocument[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const invitations = await this.invitationModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        status: InvitationStatus.PENDING,
      })
      .exec();

    await this.cacheManager.set(cacheKey, invitations, 30 * 1000);
    this.invitationCacheKeys.add(cacheKey);

    return invitations;
  }

  async updateStatus(
    id: string,
    status: InvitationStatus,
  ): Promise<InvitationDocument | null> {
    const invitation = await this.invitationModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );

    await this.clearCache();

    return invitation;
  }

  async markAccepted(
    invitationId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.invitationModel.updateOne(
      {
        _id: invitationId,
        status: InvitationStatus.PENDING,
      },
      {
        $set: {
          status: InvitationStatus.ACCEPTED,
        },
      },
      {
        session,
      },
    );

    await this.clearCache();
  }

  async markDeclined(invitationId: string): Promise<void> {
    await this.invitationModel.updateOne(
      {
        _id: invitationId,
        status: InvitationStatus.PENDING,
      },
      {
        $set: {
          status: InvitationStatus.DECLINED,
        },
      },
    );

    await this.clearCache();
  }

  private async clearCache(): Promise<void> {
    for (const key of this.invitationCacheKeys) {
      await this.cacheManager.del(key);
    }

    this.invitationCacheKeys.clear();
  }
}
