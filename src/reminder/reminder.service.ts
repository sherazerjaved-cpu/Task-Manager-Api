import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { Task, TaskDocument } from 'src/task/Schema/task.schema';
import { TaskStatus } from 'src/task/Enums/task-status.enum';
import { FeatureFlagsService } from 'src/workspace/application/services/feature-flags.service';
import { WorkspaceFeatureFlag } from 'src/workspace/domain/enums/workspace-feature-flag.enum';
import { OutboxService } from 'src/outbox/application/outbox.service';

import { EMAIL_DELIVERY_REPOSITORY } from 'src/mail/domain/constants/repository.tokens';
import type { IEmailDeliveryRepository } from 'src/mail/domain/repositories/email-delivery.repository.interface';

import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,

    private readonly configService: ConfigService,

    private readonly scheduleRegistry: SchedulerRegistry,

    private readonly outboxService: OutboxService,

    private readonly featureFlagsService: FeatureFlagsService,

    @Inject(EMAIL_DELIVERY_REPOSITORY)
    private readonly emailDeliveryRepository: IEmailDeliveryRepository,
  ) {}

  onModuleInit(): void {
    const expression = this.configService.get<string>('REMINDER_CRON');

    if (!expression) {
      throw new Error('REMINDER_CRON is not defined');
    }

    const job = new CronJob(expression, async () => {
      await this.handleCron();
    });

    this.scheduleRegistry.addCronJob('task-reminders', job);

    job.start();

    this.logger.log(`Reminder cron started with expression: ${expression}`);
  }

  async handleCron(): Promise<void> {
    const now = new Date();

    const reminderWindow = new Date();
    reminderWindow.setHours(reminderWindow.getHours() + 24);

    const reminderTasks = await this.taskModel
      .find({
        dueDate: {
          $gte: now,
          $lte: reminderWindow,
        },
        status: {
          $ne: TaskStatus.Done,
        },
        isDeleted: false,
        reminderSent: {
          $ne: true,
        },
      })
      .populate('owner');

    if (reminderTasks.length === 0) {
      this.logger.log('No upcoming tasks found');

      return;
    }

    this.logger.log(
      `Found ${reminderTasks.length} task(s) due within 24 hours`,
    );

    for (const task of reminderTasks) {
      try {
        const workspaceId = task.workspace?.toString();

        if (!workspaceId) {
          this.logger.warn(
            `Skipping reminder for task ${task._id.toString()}: workspace is missing`,
          );

          continue;
        }

        const remindersEnabled = await this.featureFlagsService.isEnabled(
          workspaceId,
          WorkspaceFeatureFlag.REMINDERS,
        );

        if (!remindersEnabled) {
          this.logger.log(
            `Skipping reminder for task ${task._id.toString()}: reminders are disabled for workspace ${workspaceId}`,
          );

          continue;
        }

        const emailNotificationsEnabled =
          await this.featureFlagsService.isEnabled(
            workspaceId,
            WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS,
          );

        if (!emailNotificationsEnabled) {
          this.logger.log(
            `Skipping reminder for task ${task._id.toString()}: email notifications are disabled for workspace ${workspaceId}`,
          );
          continue;
        }
        const owner = task.owner as unknown as {
          email: string;
        };

        if (!owner?.email) {
          this.logger.warn(
            `Skipping reminder for task ${task._id.toString()}: owner email is missing`,
          );

          continue;
        }

        const outboxEventId = new Types.ObjectId();

        await this.emailDeliveryRepository.create({
          outboxEventId,
          to: owner.email,
          emailType: 'TASK_REMINDER',
          status: EmailDeliveryStatus.QUEUED,
        });

        await this.outboxService.create({
          id: outboxEventId.toString(),
          eventType: 'REMINDER_DUE',
          aggregateType: 'TASK',
          aggregateId: task._id.toString(),
          workspaceId: task.workspace?.toString(),
          payload: {
            to: owner.email,
            taskTitle: task.title,
            dueDate: task.dueDate,
            priority: task.priority,
          },
        });

        await this.taskModel.findByIdAndUpdate(task._id, {
          reminderSent: true,
        });

        this.logger.log(
          `Reminder outbox event and email delivery created for task ${task._id.toString()}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to create reminder for task ${task._id.toString()}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
