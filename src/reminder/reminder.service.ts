import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Task, TaskDocument } from 'src/task/Schema/task.schema';
import { Model } from 'mongoose';
import { TaskStatus } from 'src/task/Enums/task-status.enum';
import { ConfigService } from '@nestjs/config';
import {CronJob} from "cron";
import { OnModuleInit } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class ReminderService implements OnModuleInit{
  private readonly logger = new Logger(ReminderService.name);

  constructor (@InjectModel(Task.name) private readonly taskModel:Model<TaskDocument>,
    private readonly configService:ConfigService, private readonly scheduleRegistry:SchedulerRegistry,
    private readonly mailService:MailService){}


async onModuleInit() {
    const expression = this.configService.get<string>("REMINDER_CRON");
    if(!expression){
        throw new Error (`REMINDER_CRON is not defined`)
    }
    const job = new CronJob(expression, async ()=>{
        await this.handleCron();
    })

    this.scheduleRegistry.addCronJob("task-reminders", job);
    job.start();
    this.logger.log(`Reminder cron started with expression: ${expression}`)
}

  async handleCron() {
    const now = new Date();
    const reminderWindow = new Date();
    reminderWindow.setHours(reminderWindow.getHours() +24);
    
    const reminderTasks = await this.taskModel.find({dueDate:{$gte:now, $lte:reminderWindow},
    status:{$ne:TaskStatus.Done}, isDeleted:false,  reminderSent:{ $ne: true }}).populate('owner');

    if(reminderTasks.length === 0){
        this.logger.log("No upcoming tasks found");
        return;
    }
    this.logger.log(`Found ${reminderTasks.length} task(s) due within 24 hours`)
    
    for (const task of reminderTasks) {
          try {const owner = task.owner as unknown as { email: string };
            if (!owner?.email) { this.logger.warn(
        `Skipping reminder for "${task.title}" because owner email is missing`,
        );
        continue;
        }

    await this.mailService.sendReminderEmail(owner.email, task.title, task.dueDate, task.priority);
    await this.taskModel.findByIdAndUpdate(task._id, {reminderSent: true});

        this.logger.log(
      `Reminder email sent for task "${task.title}" to ${owner.email}`,
        );

    } catch (error) {
        this.logger.error(
          `Failed to send reminder for task "${task.title}"`,
        error instanceof Error ? error.stack : String(error),
    );
    }
   }}
}