import { CreateWorkspaceDto } from '../../dto/create-workspace.dto';

export class CreateWorkspaceCommand {
  constructor(
    public readonly dto: CreateWorkspaceDto,
    public readonly ownerId: string,
  ) {}
}
