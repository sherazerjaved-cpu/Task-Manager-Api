import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { CreateActivityCommand } from './create-activity.command';

import { ACTIVITY_REPOSITORY } from '../../../domain/repositories/activity.repository.interface';
import type { IActivityRepository } from '../../../domain/repositories/activity.repository.interface';

@CommandHandler(CreateActivityCommand)
export class CreateActivityHandler implements ICommandHandler<CreateActivityCommand> {
  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(command: CreateActivityCommand) {
    return this.activityRepository.create(command.createActivityDto);
  }
}
