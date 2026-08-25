import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateWorkspaceSettingsCommand } from './update-workspace-settings.command';
import { WorkspaceSettingsService } from '../../services/workspace-settings.service';

@CommandHandler(UpdateWorkspaceSettingsCommand)
export class UpdateWorkspaceSettingsHandler implements ICommandHandler<UpdateWorkspaceSettingsCommand> {
  constructor(
    private readonly workspaceSettingsService: WorkspaceSettingsService,
  ) {}

  async execute(command: UpdateWorkspaceSettingsCommand) {
    return this.workspaceSettingsService.updateSettings(
      command.workspaceId,
      command.dto,
    );
  }
}
