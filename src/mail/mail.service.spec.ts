import { Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  let mailerService: {
    sendMail: jest.Mock;
  };

  beforeEach(() => {
    mailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    service = new MailService(mailerService as unknown as MailerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.API_URL;
  });

  describe('sendReminderEmail', () => {
    it('should send a reminder email', async () => {
      const dueDate = new Date('2026-08-20T15:30:00.000Z');

      await service.sendReminderEmail(
        'user@example.com',
        'Complete project',
        dueDate,
        'high',
      );

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Reminder: "Complete project" is due soon',
        html: expect.stringContaining('Task Reminder'),
      });
    });

    it('should include task information in the reminder email', async () => {
      const dueDate = new Date('2026-08-20T15:30:00.000Z');

      await service.sendReminderEmail(
        'user@example.com',
        'Complete project',
        dueDate,
        'high',
      );

      const mail = mailerService.sendMail.mock.calls[0][0];

      expect(mail.html).toContain('Complete project');
      expect(mail.html).toContain('high');
      expect(mail.html).toContain(dueDate.toLocaleString());
    });

    it('should log success after sending the reminder email', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation();

      await service.sendReminderEmail(
        'user@example.com',
        'Complete project',
        new Date(),
        'medium',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Reminder email sent successfully',
      );
    });

    it('should rethrow the error when sending the reminder email fails', async () => {
      const error = new Error('SMTP connection failed');

      mailerService.sendMail.mockRejectedValue(error);

      await expect(
        service.sendReminderEmail(
          'user@example.com',
          'Complete project',
          new Date(),
          'high',
        ),
      ).rejects.toThrow('SMTP connection failed');
    });

    it('should log an error when sending the reminder email fails', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const error = new Error('SMTP connection failed');

      mailerService.sendMail.mockRejectedValue(error);

      await expect(
        service.sendReminderEmail(
          'user@example.com',
          'Complete project',
          new Date(),
          'high',
        ),
      ).rejects.toThrow('SMTP connection failed');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send reminder email',
        expect.any(String),
      );
    });

    it('should handle a non-Error rejection', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mailerService.sendMail.mockRejectedValue('SMTP failure');

      await expect(
        service.sendReminderEmail(
          'user@example.com',
          'Complete project',
          new Date(),
          'high',
        ),
      ).rejects.toBe('SMTP failure');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send reminder email',
        'SMTP failure',
      );
    });
  });

  describe('sendWorkspaceInvitation', () => {
    it('should send a workspace invitation email', async () => {
      process.env.API_URL = 'http://localhost:3000';

      const expiresAt = new Date('2026-08-25T12:00:00.000Z');

      await service.sendWorkspaceInvitation(
        'user@example.com',
        'Engineering',
        'invite-token-123',
        expiresAt,
      );

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Invitation to join Engineering',
        html: expect.stringContaining('Engineering'),
      });
    });

    it('should include the invitation URL', async () => {
      process.env.API_URL = 'http://localhost:3000';

      await service.sendWorkspaceInvitation(
        'user@example.com',
        'Engineering',
        'invite-token-123',
        new Date(),
      );

      const mail = mailerService.sendMail.mock.calls[0][0];

      expect(mail.html).toContain(
        'http://localhost:3000/api/v1/invitations/invite-token-123/accept',
      );
    });

    it('should use the default API URL when API_URL is not set', async () => {
      delete process.env.API_URL;

      await service.sendWorkspaceInvitation(
        'user@example.com',
        'Engineering',
        'invite-token-123',
        new Date(),
      );

      const mail = mailerService.sendMail.mock.calls[0][0];

      expect(mail.html).toContain(
        'http://localhost:3000/api/v1/invitations/invite-token-123/accept',
      );
    });

    it('should log success after sending the invitation', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation();

      await service.sendWorkspaceInvitation(
        'user@example.com',
        'Engineering',
        'invite-token',
        new Date(),
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Workspace invitation email sent successfully',
      );
    });

    it('should rethrow errors from the mailer', async () => {
      const error = new Error('SMTP unavailable');

      mailerService.sendMail.mockRejectedValue(error);

      await expect(
        service.sendWorkspaceInvitation(
          'user@example.com',
          'Engineering',
          'invite-token',
          new Date(),
        ),
      ).rejects.toThrow('SMTP unavailable');
    });

    it('should log an error when sending the invitation fails', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mailerService.sendMail.mockRejectedValue(new Error('SMTP unavailable'));

      await expect(
        service.sendWorkspaceInvitation(
          'user@example.com',
          'Engineering',
          'invite-token',
          new Date(),
        ),
      ).rejects.toThrow('SMTP unavailable');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send workspace invitation email',
        expect.any(String),
      );
    });

    it('should handle a non-Error rejection', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mailerService.sendMail.mockRejectedValue('SMTP unavailable');

      await expect(
        service.sendWorkspaceInvitation(
          'user@example.com',
          'Engineering',
          'invite-token',
          new Date(),
        ),
      ).rejects.toBe('SMTP unavailable');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send workspace invitation email',
        'SMTP unavailable',
      );
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send an email verification message', async () => {
      await service.sendVerificationEmail(
        'user@example.com',
        'verification-token',
        new Date('2026-08-25T12:00:00.000Z'),
      );

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Verify your email address',
        html: expect.stringContaining('Email Verification'),
      });
    });

    it('should include the encoded verification token in the URL', async () => {
      process.env.API_URL = 'http://localhost:3000';

      const token = 'token with special&characters';

      await service.sendVerificationEmail(
        'user@example.com',
        token,
        new Date(),
      );

      const mail = mailerService.sendMail.mock.calls[0][0];

      expect(mail.html).toContain(
        `http://localhost:3000/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
      );
    });

    it('should use the default API URL when API_URL is not set', async () => {
      delete process.env.API_URL;

      await service.sendVerificationEmail(
        'user@example.com',
        'verification-token',
        new Date(),
      );

      const mail = mailerService.sendMail.mock.calls[0][0];

      expect(mail.html).toContain(
        'http://localhost:3000/api/v1/auth/verify-email',
      );
    });

    it('should log success after sending the verification email', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation();

      await service.sendVerificationEmail(
        'user@example.com',
        'verification-token',
        new Date(),
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Email verification message sent successfully',
      );
    });

    it('should rethrow errors from the mailer', async () => {
      const error = new Error('SMTP failure');

      mailerService.sendMail.mockRejectedValue(error);

      await expect(
        service.sendVerificationEmail(
          'user@example.com',
          'verification-token',
          new Date(),
        ),
      ).rejects.toThrow('SMTP failure');
    });

    it('should log an error when verification email fails', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mailerService.sendMail.mockRejectedValue(new Error('SMTP failure'));

      await expect(
        service.sendVerificationEmail(
          'user@example.com',
          'verification-token',
          new Date(),
        ),
      ).rejects.toThrow('SMTP failure');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send email verification message',
        expect.any(String),
      );
    });

    it('should handle a non-Error rejection', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mailerService.sendMail.mockRejectedValue('SMTP failure');

      await expect(
        service.sendVerificationEmail(
          'user@example.com',
          'verification-token',
          new Date(),
        ),
      ).rejects.toBe('SMTP failure');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send email verification message',
        'SMTP failure',
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email', async () => {
      await service.sendPasswordResetEmail(
        'user@example.com',
        'reset-token',
        new Date('2026-08-25T12:00:00.000Z'),
      );

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Reset your password',
        html: expect.stringContaining('Password Reset'),
      });
    });

    it('should include the encoded reset token in the URL', async () => {
      process.env.API_URL = 'http://localhost:3000';

      const token = 'reset token&123';

      await service.sendPasswordResetEmail(
        'user@example.com',
        token,
        new Date(),
      );

      const mail = mailerService.sendMail.mock.calls[0][0];

      expect(mail.html).toContain(
        `http://localhost:3000/reset-password?token=${encodeURIComponent(token)}`,
      );
    });

    it('should use the default API URL when API_URL is not set', async () => {
      delete process.env.API_URL;

      await service.sendPasswordResetEmail(
        'user@example.com',
        'reset-token',
        new Date(),
      );

      const mail = mailerService.sendMail.mock.calls[0][0];

      expect(mail.html).toContain(
        'http://localhost:3000/reset-password?token=reset-token',
      );
    });

    it('should log success after sending the password reset email', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation();

      await service.sendPasswordResetEmail(
        'user@example.com',
        'reset-token',
        new Date(),
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Password reset email sent successfully',
      );
    });

    it('should rethrow errors from the mailer', async () => {
      const error = new Error('SMTP failure');

      mailerService.sendMail.mockRejectedValue(error);

      await expect(
        service.sendPasswordResetEmail(
          'user@example.com',
          'reset-token',
          new Date(),
        ),
      ).rejects.toThrow('SMTP failure');
    });

    it('should log an error when password reset email fails', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mailerService.sendMail.mockRejectedValue(new Error('SMTP failure'));

      await expect(
        service.sendPasswordResetEmail(
          'user@example.com',
          'reset-token',
          new Date(),
        ),
      ).rejects.toThrow('SMTP failure');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send password reset email',
        expect.any(String),
      );
    });

    it('should handle a non-Error rejection', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      mailerService.sendMail.mockRejectedValue('SMTP failure');

      await expect(
        service.sendPasswordResetEmail(
          'user@example.com',
          'reset-token',
          new Date(),
        ),
      ).rejects.toBe('SMTP failure');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send password reset email',
        'SMTP failure',
      );
    });
  });
});
