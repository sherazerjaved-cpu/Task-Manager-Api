import { WorkspaceDocument } from '../../infrastructure/persistence/schemas/workspace.schema';

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');

export interface IWorkspaceRepository {
  create(
    name: string,
    slug: string,
    ownerId: string,
  ): Promise<WorkspaceDocument>;

  findById(id: string): Promise<WorkspaceDocument | null>;

  findByOwner(ownerId: string): Promise<WorkspaceDocument[]>;

  findByIds(ids: string[]): Promise<WorkspaceDocument[]>;

  findBySlug(slug: string): Promise<WorkspaceDocument | null>;
}
