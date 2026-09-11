import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetTaskActivitiesQuery } from './get-task-activities.query';

import { ACTIVITY_REPOSITORY } from '../../../domain/repositories/activity.repository.interface';
import type { IActivityRepository } from '../../../domain/repositories/activity.repository.interface';

@QueryHandler(GetTaskActivitiesQuery)
export class GetTaskActivitiesHandler implements IQueryHandler<GetTaskActivitiesQuery> {
  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(query: GetTaskActivitiesQuery) {
    return this.activityRepository.findByTask(query.taskId);
  }
}
