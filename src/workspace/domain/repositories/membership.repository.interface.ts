import { MembershipDocument } from '../../infrastructure/persistence/schemas/membership.schema';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { ClientSession } from 'mongoose';

export const MEMBERSHIP_REPOSITORY = Symbol('MEMBERSHIP_REPOSITORY');

export interface IMembershipRepository {
  create(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    session?: ClientSession,
  ): Promise<MembershipDocument>;

  findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipDocument | null>;

  findByUser(userId: string): Promise<MembershipDocument[]>;

  findByWorkspace(workspaceId: string): Promise<MembershipDocument[]>;

  exists(workspaceId: string, userId: string): Promise<boolean>;
}
