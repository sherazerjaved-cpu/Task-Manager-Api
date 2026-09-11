import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';
import { Workspace, WorkspaceDocument } from '../schemas/workspace.schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class WorkspaceRepository implements IWorkspaceRepository {
  private readonly workspaceCacheKeys = new Set<string>();

  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(
    name: string,
    slug: string,
    ownerId: string,
  ): Promise<WorkspaceDocument> {
    const workspace = await this.workspaceModel.create({
      name,
      slug,
      owner: new Types.ObjectId(ownerId),
    });

    await this.clearCache();

    return workspace;
  }

  async findById(id: string): Promise<WorkspaceDocument | null> {
    const cacheKey = `workspace:${id}`;

    const cached = await this.cacheManager.get<WorkspaceDocument>(cacheKey);

    if (cached) {
      return cached;
    }

    const workspace = await this.workspaceModel.findById(id).exec();

    if (workspace) {
      await this.cacheManager.set(cacheKey, workspace, 60 * 1000);
      this.workspaceCacheKeys.add(cacheKey);
    }

    return workspace;
  }

  async findByOwner(ownerId: string): Promise<WorkspaceDocument[]> {
    const cacheKey = `workspaces:owner:${ownerId}`;

    const cached = await this.cacheManager.get<WorkspaceDocument[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const workspaces = await this.workspaceModel
      .find({
        owner: new Types.ObjectId(ownerId),
      })
      .exec();

    await this.cacheManager.set(cacheKey, workspaces, 60 * 1000);
    this.workspaceCacheKeys.add(cacheKey);

    return workspaces;
  }

  async findByIds(ids: string[]): Promise<WorkspaceDocument[]> {
    const sortedIds = [...ids].sort();
    const cacheKey = `workspaces:ids:${sortedIds.join(',')}`;

    const cached = await this.cacheManager.get<WorkspaceDocument[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const workspaces = await this.workspaceModel
      .find({
        _id: {
          $in: ids.map((id) => new Types.ObjectId(id)),
        },
      })
      .exec();

    await this.cacheManager.set(cacheKey, workspaces, 60 * 1000);
    this.workspaceCacheKeys.add(cacheKey);

    return workspaces;
  }

  async findBySlug(slug: string): Promise<WorkspaceDocument | null> {
    const cacheKey = `workspace:slug:${slug}`;

    const cached = await this.cacheManager.get<WorkspaceDocument>(cacheKey);

    if (cached) {
      return cached;
    }

    const workspace = await this.workspaceModel.findOne({ slug }).exec();

    if (workspace) {
      await this.cacheManager.set(cacheKey, workspace, 60 * 1000);
      this.workspaceCacheKeys.add(cacheKey);
    }

    return workspace;
  }

  async clearCache(): Promise<void> {
    for (const key of this.workspaceCacheKeys) {
      await this.cacheManager.del(key);
    }

    this.workspaceCacheKeys.clear();
  }
}
