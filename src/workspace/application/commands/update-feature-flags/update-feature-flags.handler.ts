import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateFeatureFlagsCommand } from './update-feature-flags.command';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { WorkspaceFeatureFlag } from '../../../domain/enums/workspace-feature-flag.enum';

@CommandHandler(UpdateFeatureFlagsCommand)
export class UpdateFeatureFlagsHandler implements ICommandHandler<UpdateFeatureFlagsCommand> {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  async execute(command: UpdateFeatureFlagsCommand) {
    const flags: Partial<Record<WorkspaceFeatureFlag, boolean>> = {};

    if (command.dto.webhooks !== undefined) {
      flags[WorkspaceFeatureFlag.WEBHOOKS] = command.dto.webhooks;
    }

    if (command.dto.exports !== undefined) {
      flags[WorkspaceFeatureFlag.EXPORTS] = command.dto.exports;
    }

    if (command.dto.reminders !== undefined) {
      flags[WorkspaceFeatureFlag.REMINDERS] = command.dto.reminders;
    }

    if (command.dto.emailNotifications !== undefined) {
      flags[WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS] =
        command.dto.emailNotifications;
    }

    if (command.dto.advancedTaskFiltering !== undefined) {
      flags[WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING] =
        command.dto.advancedTaskFiltering;
    }

    return this.featureFlagsService.updateFlags(command.workspaceId, flags);
  }
}
