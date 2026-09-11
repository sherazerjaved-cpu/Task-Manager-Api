import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetAllActivitiesQuery } from './get-all-activities.query';

import { ACTIVITY_REPOSITORY } from '../../../domain/repositories/activity.repository.interface';
import type { IActivityRepository } from '../../../domain/repositories/activity.repository.interface';

@QueryHandler(GetAllActivitiesQuery)
export class GetAllActivitiesHandler implements IQueryHandler<GetAllActivitiesQuery> {
  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(query: GetAllActivitiesQuery) {
    void query;
    return this.activityRepository.findAll();
  }
}
