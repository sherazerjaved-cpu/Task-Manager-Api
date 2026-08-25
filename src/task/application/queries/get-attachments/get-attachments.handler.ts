import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import { GetAttachmentsQuery } from './get-attachments.query';

import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';

@QueryHandler(GetAttachmentsQuery)
export class GetAttachmentsHandler implements IQueryHandler<GetAttachmentsQuery> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetAttachmentsQuery) {
    const task = await this.taskRepository.findAuthorizedTask(
      query.taskId,
      query.userId,
      query.role,
      query.workspaceId,
    );

    return task.attachments;
  }
}
