import { InvitationDocument } from '../../infrastructure/persistence/schemas/invitation.schema';
import { InvitationStatus } from '../enums/invitation-status.enum';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { ClientSession } from 'mongoose';

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');

export interface IInvitationRepository {
  create(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    tokenHash: string,
    expiresAt: Date,
    invitedBy: string,
  ): Promise<InvitationDocument>;

  findByTokenHash(tokenHash: string): Promise<InvitationDocument | null>;

  findPendingByEmail(email: string): Promise<InvitationDocument[]>;

  findPendingByWorkspace(workspaceId: string): Promise<InvitationDocument[]>;

  updateStatus(
    id: string,
    status: InvitationStatus,
  ): Promise<InvitationDocument | null>;

  markAccepted(invitationId: string, session?: ClientSession): Promise<void>;

  markDeclined(invitationId: string): Promise<void>;
}
