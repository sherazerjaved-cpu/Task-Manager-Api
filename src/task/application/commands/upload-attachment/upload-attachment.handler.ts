import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Types } from 'mongoose';
import { UploadAttachmentCommand } from './upload-attachment.command';
import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';
import { ACTIVITY_REPOSITORY } from 'src/activity/domain/repositories/activity.repository.interface';
import type { IActivityRepository } from 'src/activity/domain/repositories/activity.repository.interface';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(UploadAttachmentCommand)
export class UploadAttachmentHandler implements ICommandHandler<UploadAttachmentCommand> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: UploadAttachmentCommand) {
    const { taskId, file, userId, role, workspaceId } = command;

    await this.taskRepository.findAuthorizedTask(
      taskId,
      userId,
      role,
      workspaceId,
    );

    const task = await this.taskRepository.uploadAttachment(taskId, file);

    const attachment = task.attachments[task.attachments.length - 1];

    await this.activityRepository.create({
      task: task._id,
      user: new Types.ObjectId(userId),
      action: ActivityAction.ATTACHMENT_ADDED,
      description: 'Attachment added',
    });

    await this.auditService.log({
      actorId: userId,
      action: 'ATTACHMENT_ADDED',
      resource: 'ATTACHMENT',
      workspaceId,
      meta: {
        attachmentId: attachment?._id?.toString(),
        taskId: task._id.toString(),
      },
    });

    await this.taskRepository.clearCache();

    return task.attachments;
  }
}
