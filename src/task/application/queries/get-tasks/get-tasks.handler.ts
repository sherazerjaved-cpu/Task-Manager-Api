import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException } from '@nestjs/common';
import { GetTasksQuery } from './get-tasks.query';
import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import { MEMBERSHIP_REPOSITORY } from 'src/workspace/domain/repositories/membership.repository.interface';
import type { IMembershipRepository } from 'src/workspace/domain/repositories/membership.repository.interface';

@QueryHandler(GetTasksQuery)
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,
  ) {}

  async execute(query: GetTasksQuery) {
    const membership = await this.membershipRepository.findByWorkspaceAndUser(
      query.workspaceId,
      query.userId,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return this.taskRepository.findAll(
      query.userId,
      query.role,
      query.workspaceId,
      query.query,
    );
  }
}
