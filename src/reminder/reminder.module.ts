import { Module, forwardRef } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { TaskModule } from 'src/task/task.module';
import { MailModule } from 'src/mail/mail.module';
import { OutboxModule } from 'src/outbox/outbox.module';
import { WorkspaceModule } from 'src/workspace/workspace.module';

@Module({
  imports: [
    forwardRef(() => WorkspaceModule),
    TaskModule,
    MailModule,
    OutboxModule,
  ],
  providers: [ReminderService],
})
export class ReminderModule {}
