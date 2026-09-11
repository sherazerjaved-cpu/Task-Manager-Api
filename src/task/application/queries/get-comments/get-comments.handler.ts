import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import { GetCommentsQuery } from './get-comments.query';

import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';

@QueryHandler(GetCommentsQuery)
export class GetCommentsHandler implements IQueryHandler<GetCommentsQuery> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetCommentsQuery) {
    const task = await this.taskRepository.findAuthorizedTask(
      query.taskId,
      query.userId,
      query.role,
      query.workspaceId,
    );

    const updatedTask = await this.taskRepository.getComments(
      task._id.toString(),
    );

    return updatedTask.comments;
  }
}
