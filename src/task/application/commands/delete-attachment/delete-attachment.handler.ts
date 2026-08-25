import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DeleteAttachmentCommand } from './delete-attachment.command';
import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';
import { FileStorageService } from 'src/task/infrastructure/storage/file-storage.service';
import { ACTIVITY_REPOSITORY } from 'src/activity/domain/repositories/activity.repository.interface';
import type { IActivityRepository } from 'src/activity/domain/repositories/activity.repository.interface';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(DeleteAttachmentCommand)
export class DeleteAttachmentHandler implements ICommandHandler<DeleteAttachmentCommand> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,

    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: IActivityRepository,

    private readonly fileStorageService: FileStorageService,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: DeleteAttachmentCommand) {
    const { taskId, attachmentId, userId, role, workspaceId } = command;

    const task = await this.taskRepository.findAuthorizedTask(
      taskId,
      userId,
      role,
      workspaceId,
    );

    const attachment = task.attachments.find(
      (attachment) => attachment._id?.toString() === attachmentId.toString(),
    );

    if (!attachment) {
      throw new NotFoundException('Attachment Not Found');
    }

    this.fileStorageService.deleteFile(attachment.url);

    await this.taskRepository.deleteAttachment(taskId, attachmentId);

    await this.activityRepository.create({
      task: task._id,
      user: new Types.ObjectId(userId),
      action: ActivityAction.ATTACHMENT_DELETED,
      description: 'Attachment deleted',
    });

    await this.auditService.log({
      actorId: userId,
      action: 'ATTACHMENT_DELETED',
      resource: 'ATTACHMENT',
      workspaceId,
      meta: {
        attachmentId,
        taskId,
      },
    });

    await this.taskRepository.clearCache();

    return {
      message: 'Attachment deleted successfully.',
    };
  }
}
