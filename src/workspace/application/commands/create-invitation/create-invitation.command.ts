import { CreateInvitationDto } from '../../dto/create-invitation.dto';

export class CreateInvitationCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly dto: CreateInvitationDto,
    public readonly invitedBy: string,
  ) {}
}
