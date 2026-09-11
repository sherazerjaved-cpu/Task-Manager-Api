import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Types } from 'mongoose';
import { DeleteTaskCommand } from './delete-task.command';
import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';
import { TaskGateway } from 'src/websocket/task/task.gateway';
import { ACTIVITY_REPOSITORY } from 'src/activity/domain/repositories/activity.repository.interface';
import type { IActivityRepository } from 'src/activity/domain/repositories/activity.repository.interface';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,

    private readonly taskGateway: TaskGateway,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: DeleteTaskCommand) {
    const { taskId, userId, role, workspaceId } = command;

    const task = await this.taskRepository.findAuthorizedTask(
      taskId,
      userId,
      role,
      workspaceId,
    );

    task.isDeleted = true;
    task.deletedAt = new Date();

    await this.taskRepository.save(task);

    await this.activityRepository.create({
      task: task._id,
      user: new Types.ObjectId(userId),
      action: ActivityAction.DELETED,
      description: 'Task deleted',
    });

    await this.auditService.log({
      actorId: userId,
      action: 'TASK_DELETED',
      resource: 'TASK',
      workspaceId,
      meta: {
        taskId: task._id.toString(),
        deletionType: 'soft_delete',
      },
    });

    await this.taskRepository.clearCache();

    this.taskGateway.emitTaskDeleted(
      task.owner.toString(),
      task._id.toString(),
    );

    return {
      message: 'Task Deleted Successfully!',
    };
  }
}
