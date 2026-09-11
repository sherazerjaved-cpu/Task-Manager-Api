import { AddMemberDto } from '../../dto/add-member.dto';

export class AddMemberCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly dto: AddMemberDto,
    public readonly actorId: string,
  ) {}
}
