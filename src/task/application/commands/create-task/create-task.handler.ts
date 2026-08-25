import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Connection, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { CreateTaskCommand } from './create-task.command';

import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';

import { ActivityAction } from 'src/activity/enums/activity-action.enum';
import { ACTIVITY_REPOSITORY } from 'src/activity/domain/repositories/activity.repository.interface';
import type { IActivityRepository } from 'src/activity/domain/repositories/activity.repository.interface';

import { TaskGateway } from 'src/websocket/task/task.gateway';

import { CATEGORY_REPOSITORY } from 'src/categories/domain/repositories/category.repository.interface';
import type { ICategoryRepository } from 'src/categories/domain/repositories/category.repository.interface';

import { MEMBERSHIP_REPOSITORY } from 'src/workspace/domain/repositories/membership.repository.interface';
import type { IMembershipRepository } from 'src/workspace/domain/repositories/membership.repository.interface';

import { AuditService } from 'src/audit/application/audit.service';
import { OutboxService } from 'src/outbox/application/outbox.service';

import { TaskDocument } from 'src/task/Schema/task.schema';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,

    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,

    private readonly taskGateway: TaskGateway,

    private readonly auditService: AuditService,

    private readonly outboxService: OutboxService,

    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async execute(command: CreateTaskCommand) {
    const { createTaskDto, userId } = command;

    const membership = await this.membershipRepository.findByWorkspaceAndUser(
      createTaskDto.workspaceId,
      userId,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (createTaskDto.category) {
      const category = await this.categoryRepository.findById(
        createTaskDto.category,
        userId,
      );

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const session = await this.connection.startSession();

    let task: TaskDocument;

    try {
      task = await session.withTransaction(async () => {
        const createdTask = await this.taskRepository.create(
          createTaskDto,
          userId,
          session,
        );

        await this.activityRepository.create(
          {
            task: createdTask._id,
            user: new Types.ObjectId(userId),
            action: ActivityAction.CREATED,
            description: 'Task created',
          },
          session,
        );

        await this.outboxService.create(
          {
            eventType: 'TASK_CREATED',
            aggregateType: 'TASK',
            aggregateId: createdTask._id.toString(),
            workspaceId: createTaskDto.workspaceId,
            payload: {
              taskId: createdTask._id.toString(),
              ownerId: createdTask.owner.toString(),
              title: createdTask.title,
            },
          },
          session,
        );

        return createdTask;
      });
    } finally {
      await session.endSession();
    }

    await this.auditService.log({
      actorId: userId,
      action: 'TASK_CREATED',
      resource: 'TASK',
      workspaceId: createTaskDto.workspaceId,
      meta: {
        taskId: task._id.toString(),
      },
    });

    await this.taskRepository.clearCache();

    this.taskGateway.emitTaskCreated(userId, task);

    return task;
  }
}
