import { INestApplication } from '@nestjs/common';

import { Test, TestingModule } from '@nestjs/testing';

import { MailerService } from '@nestjs-modules/mailer';

import { getConnectionToken } from '@nestjs/mongoose';

import { Connection, Types } from 'mongoose';

import { shutdownIntegrationApp } from '../helpers/shutdown-helper';

import { AppModule } from '../../../src/app.module';

import { MailService } from '../../../src/mail/mail.service';

import { EMAIL_DELIVERY_REPOSITORY } from '../../../src/mail/domain/constants/repository.tokens';

import type { IEmailDeliveryRepository } from '../../../src/mail/domain/repositories/email-delivery.repository.interface';

import { EmailDeliveryStatus } from '../../../src/mail/domain/enums/email-delivery-status.enum';

import { clearDatabase } from '../setup/database';

jest.setTimeout(30000);

describe('Mail Integration (experimental)', () => {
  let app: INestApplication;
  let connection: Connection;

  let mailService: MailService;
  let emailDeliveryRepository: IEmailDeliveryRepository;

  let sendMail: jest.Mock;

  beforeAll(async () => {
    sendMail = jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({
        sendMail,
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.getHttpAdapter().getInstance().set('trust proxy', true);

    await app.init();

    connection = app.get<Connection>(getConnectionToken());

    mailService = app.get(MailService);

    emailDeliveryRepository = app.get<IEmailDeliveryRepository>(
      EMAIL_DELIVERY_REPOSITORY,
    );

    await clearDatabase(connection);
  }, 30000);

  afterEach(async () => {
    jest.clearAllMocks();

    sendMail.mockResolvedValue({
      messageId: 'test-message-id',
    });

    await clearDatabase(connection);
  });

  afterAll(async () => {
    await shutdownIntegrationApp(app, connection);
  }, 30000);

  describe('MailService', () => {
    describe('sendVerificationEmail', () => {
      it('should send an email verification email', async () => {
        const expiresAt = new Date('2026-08-21T12:00:00.000Z');

        await mailService.sendVerificationEmail(
          'user@example.com',
          'verification-token-123',
          expiresAt,
        );

        expect(sendMail).toHaveBeenCalledTimes(1);

        expect(sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@example.com',
            subject: 'Verify your email address',
            html: expect.stringContaining('verification-token-123'),
          }),
        );

        const mailOptions = sendMail.mock.calls[0][0];

        expect(mailOptions.html).toContain('/api/v1/auth/verify-email?token=');

        expect(mailOptions.html).toContain(
          encodeURIComponent('verification-token-123'),
        );
      });

      it('should propagate mailer errors', async () => {
        sendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

        await expect(
          mailService.sendVerificationEmail(
            'user@example.com',
            'verification-token',
            new Date(),
          ),
        ).rejects.toThrow('SMTP connection failed');

        expect(sendMail).toHaveBeenCalledTimes(1);
      });
    });

    describe('sendPasswordResetEmail', () => {
      it('should send a password reset email', async () => {
        const expiresAt = new Date('2026-08-21T12:00:00.000Z');

        await mailService.sendPasswordResetEmail(
          'user@example.com',
          'reset-token-456',
          expiresAt,
        );

        expect(sendMail).toHaveBeenCalledTimes(1);

        expect(sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@example.com',
            subject: 'Reset your password',
            html: expect.stringContaining('reset-token-456'),
          }),
        );

        const mailOptions = sendMail.mock.calls[0][0];

        expect(mailOptions.html).toContain('/reset-password?token=');

        expect(mailOptions.html).toContain(
          encodeURIComponent('reset-token-456'),
        );
      });

      it('should propagate mailer errors', async () => {
        sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));

        await expect(
          mailService.sendPasswordResetEmail(
            'user@example.com',
            'reset-token',
            new Date(),
          ),
        ).rejects.toThrow('SMTP unavailable');

        expect(sendMail).toHaveBeenCalledTimes(1);
      });
    });

    describe('sendWorkspaceInvitation', () => {
      it('should send a workspace invitation email', async () => {
        const expiresAt = new Date('2026-08-21T12:00:00.000Z');

        await mailService.sendWorkspaceInvitation(
          'member@example.com',
          'Engineering Workspace',
          'invitation-token-789',
          expiresAt,
        );

        expect(sendMail).toHaveBeenCalledTimes(1);

        expect(sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'member@example.com',
            subject: 'Invitation to join Engineering Workspace',
            html: expect.stringContaining('Engineering Workspace'),
          }),
        );

        const mailOptions = sendMail.mock.calls[0][0];

        expect(mailOptions.html).toContain('invitation-token-789');

        expect(mailOptions.html).toContain('/api/v1/invitations/');

        expect(mailOptions.html).toContain('/accept');
      });

      it('should propagate mailer errors', async () => {
        sendMail.mockRejectedValueOnce(new Error('Mail provider failed'));

        await expect(
          mailService.sendWorkspaceInvitation(
            'member@example.com',
            'Engineering Workspace',
            'invitation-token',
            new Date(),
          ),
        ).rejects.toThrow('Mail provider failed');

        expect(sendMail).toHaveBeenCalledTimes(1);
      });
    });

    describe('sendReminderEmail', () => {
      it('should send a task reminder email', async () => {
        const dueDate = new Date('2026-08-21T12:00:00.000Z');

        await mailService.sendReminderEmail(
          'user@example.com',
          'Finish integration tests',
          dueDate,
          'high',
        );

        expect(sendMail).toHaveBeenCalledTimes(1);

        expect(sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@example.com',
            subject: 'Reminder: "Finish integration tests" is due soon',
            html: expect.stringContaining('Finish integration tests'),
          }),
        );

        const mailOptions = sendMail.mock.calls[0][0];

        expect(mailOptions.html).toContain('Task Reminder');

        expect(mailOptions.html).toContain('high');
      });

      it('should propagate mailer errors', async () => {
        sendMail.mockRejectedValueOnce(new Error('SMTP provider unavailable'));

        await expect(
          mailService.sendReminderEmail(
            'user@example.com',
            'Test task',
            new Date(),
            'medium',
          ),
        ).rejects.toThrow('SMTP provider unavailable');

        expect(sendMail).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('EmailDeliveryRepository', () => {
    it('should create an email delivery record', async () => {
      const outboxEventId = new Types.ObjectId();

      const delivery = await emailDeliveryRepository.create({
        outboxEventId,
        to: 'user@example.com',
        emailType: 'EMAIL_VERIFICATION',
      });

      expect(delivery).toBeDefined();

      expect(delivery._id).toBeDefined();

      expect(delivery.outboxEventId.toString()).toBe(outboxEventId.toString());

      expect(delivery.to).toBe('user@example.com');

      expect(delivery.emailType).toBe('EMAIL_VERIFICATION');

      expect(delivery.status).toBe(EmailDeliveryStatus.QUEUED);

      expect(delivery.attempts).toBe(0);
    });

    it('should create a delivery with the provided status and attempts', async () => {
      const outboxEventId = new Types.ObjectId();

      const delivery = await emailDeliveryRepository.create({
        outboxEventId,
        to: 'user@example.com',
        emailType: 'PASSWORD_RESET',
        status: EmailDeliveryStatus.SENDING,
        attempts: 2,
      });

      expect(delivery.status).toBe(EmailDeliveryStatus.SENDING);

      expect(delivery.attempts).toBe(2);
    });

    it('should find a delivery by outbox event id', async () => {
      const outboxEventId = new Types.ObjectId();

      const created = await emailDeliveryRepository.create({
        outboxEventId,
        to: 'user@example.com',
        emailType: 'EMAIL_VERIFICATION',
      });

      const found =
        await emailDeliveryRepository.findByOutboxEventId(outboxEventId);

      expect(found).not.toBeNull();

      expect(found!._id.toString()).toBe(created._id.toString());

      expect(found!.to).toBe('user@example.com');
    });

    it('should return null when the outbox event does not exist', async () => {
      const result = await emailDeliveryRepository.findByOutboxEventId(
        new Types.ObjectId(),
      );

      expect(result).toBeNull();
    });

    it('should update an email delivery record', async () => {
      const outboxEventId = new Types.ObjectId();

      const created = await emailDeliveryRepository.create({
        outboxEventId,
        to: 'user@example.com',
        emailType: 'EMAIL_VERIFICATION',
      });

      const sentAt = new Date();

      const updated = await emailDeliveryRepository.update(
        created._id.toString(),
        {
          status: EmailDeliveryStatus.SENT,
          attempts: 1,
          providerMessageId: 'provider-123',
          sentAt,
          lastError: undefined,
        },
      );

      expect(updated).not.toBeNull();

      expect(updated!.status).toBe(EmailDeliveryStatus.SENT);

      expect(updated!.attempts).toBe(1);

      expect(updated!.providerMessageId).toBe('provider-123');

      expect(updated!.sentAt).toEqual(sentAt);
    });

    it('should update a delivery to FAILED with error information', async () => {
      const outboxEventId = new Types.ObjectId();

      const created = await emailDeliveryRepository.create({
        outboxEventId,
        to: 'user@example.com',
        emailType: 'TASK_REMINDER',
      });

      const failedAt = new Date();

      const updated = await emailDeliveryRepository.update(
        created._id.toString(),
        {
          status: EmailDeliveryStatus.FAILED,
          attempts: 3,
          lastError: 'SMTP connection failed',
          failedAt,
        },
      );

      expect(updated).not.toBeNull();

      expect(updated!.status).toBe(EmailDeliveryStatus.FAILED);

      expect(updated!.attempts).toBe(3);

      expect(updated!.lastError).toBe('SMTP connection failed');

      expect(updated!.failedAt).toEqual(failedAt);
    });

    it('should return null when updating a non-existent delivery', async () => {
      const result = await emailDeliveryRepository.update(
        new Types.ObjectId().toString(),
        {
          status: EmailDeliveryStatus.SENT,
        },
      );

      expect(result).toBeNull();
    });

    it('should persist the delivery changes in MongoDB', async () => {
      const outboxEventId = new Types.ObjectId();

      const created = await emailDeliveryRepository.create({
        outboxEventId,
        to: 'persist@example.com',
        emailType: 'WORKSPACE_INVITATION',
      });

      await emailDeliveryRepository.update(created._id.toString(), {
        status: EmailDeliveryStatus.SENT,
        attempts: 1,
        providerMessageId: 'persisted-provider-id',
      });

      const found =
        await emailDeliveryRepository.findByOutboxEventId(outboxEventId);

      expect(found).not.toBeNull();

      expect(found!.status).toBe(EmailDeliveryStatus.SENT);

      expect(found!.attempts).toBe(1);

      expect(found!.providerMessageId).toBe('persisted-provider-id');
    });
  });
});
