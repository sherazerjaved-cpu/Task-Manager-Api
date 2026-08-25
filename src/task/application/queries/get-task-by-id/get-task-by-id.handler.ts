import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTaskByIdQuery } from './get-task-by-id.query';
import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';

@QueryHandler(GetTaskByIdQuery)
export class GetTaskByIdHandler implements IQueryHandler<GetTaskByIdQuery> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetTaskByIdQuery) {
    return this.taskRepository.findAuthorizedTask(
      query.taskId,
      query.userId,
      query.role,
      query.workspaceId,
    );
  }
}
