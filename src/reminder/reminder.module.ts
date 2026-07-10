import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { TaskModule } from 'src/task/task.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [TaskModule, MailModule],
  providers: [ReminderService],
})
export class ReminderModule {}
