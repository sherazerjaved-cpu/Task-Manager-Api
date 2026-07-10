import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendReminderEmail(
    to: string,
    taskTitle: string,
    dueDate: Date,
    priority: string,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Reminder: "${taskTitle}" is due soon`,
        html: `
          <h2>Task Reminder</h2>

          <p>Hello,</p>

          <p>This is a reminder that your task is due within the next 24 hours.</p>

          <ul>
            <li><strong>Task:</strong> ${taskTitle}</li>
            <li><strong>Due Date:</strong> ${dueDate.toLocaleString()}</li>
            <li><strong>Priority:</strong> ${priority}</li>
          </ul>

          <p>Please complete it before the deadline.</p>

          <br/>

          <p>Your Manager</p>
        `,
      });

      this.logger.log(`Reminder email sent to ${to}`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to send email to ${to}`, error.stack);
      } else {
        this.logger.error(`Failed to send email to ${to}`, String(error));
      }
    }
  }
}
