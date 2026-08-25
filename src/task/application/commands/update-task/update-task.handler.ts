import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';

import {
  Inject,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, Connection } from 'mongoose';

import { UpdateTaskCommand } from './update-task.command';

import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';

import { ActivityAction } from 'src/activity/enums/activity-action.enum';

import { TaskGateway } from 'src/websocket/task/task.gateway';

import { TaskCompletedEvent } from '../../events/task-completed.event';

import { TaskStatus } from 'src/task/Enums/task-status.enum';

import { ACTIVITY_REPOSITORY } from 'src/activity/domain/repositories/activity.repository.interface';
import type { IActivityRepository } from 'src/activity/domain/repositories/activity.repository.interface';

import type { ICategoryRepository } from 'src/categories/domain/repositories/category.repository.interface';
import { CATEGORY_REPOSITORY } from 'src/categories/domain/repositories/category.repository.interface';

import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(UpdateTaskCommand)
export class UpdateTaskHandler implements ICommandHandler<UpdateTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,

    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,

    private readonly taskGateway: TaskGateway,

    private readonly eventBus: EventBus,

    private readonly auditService: AuditService,

    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async execute(command: UpdateTaskCommand) {
    const {
      taskId,
      updateTaskDto,
      userId,
      role,
      workspaceId,
      expectedVersion,
    } = command;

    if (updateTaskDto.category) {
      const category = await this.categoryRepository.findByIdForRole(
        updateTaskDto.category,
        userId,
        role,
      );

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const task = await this.taskRepository.findAuthorizedTask(
      taskId,
      userId,
      role,
      workspaceId,
    );

    if (task.__v !== expectedVersion) {
      throw new PreconditionFailedException(
        'Task has been modified. Please refresh and try again.',
      );
    }

    const previousStatus = task.status;

    const changes: Record<string, { old: unknown; new: unknown }> = {};

    Object.keys(updateTaskDto).forEach((key) => {
      const oldValue = task[key];
      const newValue = updateTaskDto[key];

      if (oldValue !== newValue) {
        changes[key] = {
          old: oldValue,
          new: newValue,
        };
      }
    });

    const ownerId = (task.owner as any)._id
      ? (task.owner as any)._id.toString()
      : (task.owner as any).toString();

    const taskCompleted =
      previousStatus !== TaskStatus.Done &&
      updateTaskDto.status === TaskStatus.Done;

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const definedUpdates = Object.fromEntries(
          Object.entries(updateTaskDto).filter(
            ([, value]) => value !== undefined,
          ),
        );

        Object.assign(task, definedUpdates);

        try {
          await task.save({ session });
        } catch (error) {
          if (error instanceof Error && error.name === 'VersionError') {
            throw new PreconditionFailedException(
              'Task has been modified. Please refresh and try again.',
            );
          }

          throw error;
        }

        if (taskCompleted) {
          await this.auditService.log(
            {
              actorId: userId,
              action: 'TASK_COMPLETED',
              resource: 'TASK',
              workspaceId,
              meta: {
                taskId: task._id.toString(),
              },
            },
            session,
          );
        }

        if (Object.keys(changes).length > 0) {
          await this.activityRepository.create(
            {
              task: task._id,
              user: new Types.ObjectId(userId),
              action: ActivityAction.UPDATED,
              description: 'Task updated',
              changes,
            },
            session,
          );

          await this.auditService.log(
            {
              actorId: userId,
              action: 'TASK_UPDATED',
              resource: 'TASK',
              workspaceId,
              meta: {
                taskId: task._id.toString(),
                changedFields: Object.keys(changes),
              },
            },
            session,
          );
        }
      });

      if (taskCompleted) {
        this.eventBus.publish(
          new TaskCompletedEvent(task._id.toString(), ownerId),
        );
      }

      await this.taskRepository.clearCache();

      this.taskGateway.emitTaskUpdated(ownerId, task);

      return task;
    } finally {
      await session.endSession();
    }
  }
}
