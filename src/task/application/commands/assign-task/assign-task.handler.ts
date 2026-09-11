import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AssignTaskCommand } from './assign-task.command';
import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import { MEMBERSHIP_REPOSITORY } from 'src/workspace/domain/repositories/membership.repository.interface';
import type { IMembershipRepository } from 'src/workspace/domain/repositories/membership.repository.interface';
import { WorkspaceRole } from 'src/workspace/domain/enums/workspace-role.enum';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(AssignTaskCommand)
export class AssignTaskHandler implements ICommandHandler<AssignTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: AssignTaskCommand) {
    const { taskId, userId, workspaceId, assignTaskDto } = command;

    const task = await this.taskRepository.findById(taskId, workspaceId);

    if (!task) {
      throw new NotFoundException('Task Not Found');
    }

    const actorMembership =
      await this.membershipRepository.findByWorkspaceAndUser(
        task.workspace.toString(),
        userId,
      );

    if (!actorMembership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (
      actorMembership.role !== WorkspaceRole.OWNER &&
      actorMembership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException('You are not allowed to assign tasks');
    }

    for (const assigneeId of assignTaskDto.userIds) {
      const assigneeMembership =
        await this.membershipRepository.findByWorkspaceAndUser(
          task.workspace.toString(),
          assigneeId,
        );

      if (!assigneeMembership) {
        throw new ForbiddenException(
          `User ${assigneeId} is not a member of this workspace`,
        );
      }
    }

    const updatedTask = await this.taskRepository.assignUsers(
      taskId,
      assignTaskDto.userIds,
    );

    await this.auditService.log({
      actorId: userId,
      action: 'TASK_ASSIGNED',
      resource: 'TASK',
      workspaceId,
      meta: {
        taskId,
        assigneeIds: assignTaskDto.userIds,
      },
    });

    return updatedTask;
  }
}
