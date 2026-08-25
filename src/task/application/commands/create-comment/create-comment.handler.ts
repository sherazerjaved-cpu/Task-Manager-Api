import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateCommentCommand } from './create-comment.command';
import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';
import { ACTIVITY_REPOSITORY } from 'src/activity/domain/repositories/activity.repository.interface';
import type { IActivityRepository } from 'src/activity/domain/repositories/activity.repository.interface';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(CreateCommentCommand)
export class CreateCommentHandler implements ICommandHandler<CreateCommentCommand> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateCommentCommand) {
    const { taskId, createCommentDto, userId, role, workspaceId } = command;

    const task = await this.taskRepository.findAuthorizedTask(
      taskId,
      userId,
      role,
      workspaceId,
    );

    const updatedTask = await this.taskRepository.addComment(
      taskId,
      createCommentDto,
      userId,
    );

    await this.activityRepository.create({
      task: task._id,
      user: new Types.ObjectId(userId),
      action: ActivityAction.COMMENT_ADDED,
      description: 'Comment added',
    });

    await this.auditService.log({
      actorId: userId,
      action: 'COMMENT_CREATED',
      resource: 'COMMENT',
      workspaceId,
      meta: {
        taskId,
      },
    });

    await this.taskRepository.clearCache();

    return updatedTask;
  }
}
