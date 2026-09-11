import { UpdateWorkspaceSettingsDto } from '../../dto/update-workspace-settings.dto';

export class UpdateWorkspaceSettingsCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly dto: UpdateWorkspaceSettingsDto,
    public readonly userId: string,
  ) {}
}
