import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetUserActivitiesQuery } from './get-user-activities.query';

import { ACTIVITY_REPOSITORY } from '../../../domain/repositories/activity.repository.interface';
import type { IActivityRepository } from '../../../domain/repositories/activity.repository.interface';

@QueryHandler(GetUserActivitiesQuery)
export class GetUserActivitiesHandler implements IQueryHandler<GetUserActivitiesQuery> {
  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(query: GetUserActivitiesQuery) {
    return this.activityRepository.findByUser(query.userId);
  }
}
