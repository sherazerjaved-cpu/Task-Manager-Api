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

          <p>
            This is a reminder that your task is due
            within the next 24 hours.
          </p>

          <ul>
            <li>
              <strong>Task:</strong> ${taskTitle}
            </li>
            <li>
              <strong>Due Date:</strong>
              ${dueDate.toLocaleString()}
            </li>
            <li>
              <strong>Priority:</strong> ${priority}
            </li>
          </ul>

          <p>
            Please complete it before the deadline.
          </p>

          <br />

          <p>Your Manager</p>
        `,
      });

      this.logger.log('Reminder email sent successfully');
    } catch (error) {
      this.logger.error(
        'Failed to send reminder email',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async sendWorkspaceInvitation(
    to: string,
    workspaceName: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:3000';

      const invitationUrl = `${apiUrl}/api/v1/invitations/${token}/accept`;

      await this.mailerService.sendMail({
        to,
        subject: `Invitation to join ${workspaceName}`,
        html: `
          <h2>Workspace Invitation</h2>

          <p>
            You have been invited to join
            <strong>${workspaceName}</strong>.
          </p>

          <p>
            Use the following link to accept
            the invitation:
          </p>

          <p>
            <a href="${invitationUrl}">
              Accept Invitation
            </a>
          </p>

          <p>
            This invitation expires on
            <strong>${expiresAt.toLocaleString()}</strong>.
          </p>

          <p>
            If you were not expecting this email,
            you can safely ignore it.
          </p>
        `,
      });

      this.logger.log('Workspace invitation email sent successfully');
    } catch (error) {
      this.logger.error(
        'Failed to send workspace invitation email',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async sendVerificationEmail(
    to: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:3000';

      const verificationUrl = `${apiUrl}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`;

      await this.mailerService.sendMail({
        to,
        subject: 'Verify your email address',
        html: `
          <h2>Email Verification</h2>

          <p>Hello,</p>

          <p>
            Thank you for registering.
            Please verify your email address by
            clicking the link below:
          </p>

          <p>
            <a href="${verificationUrl}">
              Verify Email
            </a>
          </p>

          <p>
            This verification link expires on
            <strong>${expiresAt.toLocaleString()}</strong>.
          </p>

          <p>
            If you did not create this account,
            you can safely ignore this email.
          </p>
        `,
      });

      this.logger.log('Email verification message sent successfully');
    } catch (error) {
      this.logger.error(
        'Failed to send email verification message',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:3000';

      const resetUrl = `${apiUrl}/reset-password?token=${encodeURIComponent(token)}`;

      await this.mailerService.sendMail({
        to,
        subject: 'Reset your password',
        html: `
          <h2>Password Reset</h2>

          <p>Hello,</p>

          <p>
            We received a request to reset your password.
          </p>

          <p>
            Click the link below to reset your password:
          </p>

          <p>
            <a href="${resetUrl}">
              Reset Password
            </a>
          </p>

          <p>
            This password reset link expires on
            <strong>${expiresAt.toLocaleString()}</strong>.
          </p>

          <p>
            If you did not request a password reset,
            you can safely ignore this email.
          </p>
        `,
      });

      this.logger.log('Password reset email sent successfully');
    } catch (error) {
      this.logger.error(
        'Failed to send password reset email',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }
}
