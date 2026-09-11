import { Test, TestingModule } from '@nestjs/testing';
import { ForgotPasswordHandler } from './forgot-password.handler';
import { ForgotPasswordCommand } from './forgot-password.command';

import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { EMAIL_DELIVERY_REPOSITORY } from 'src/mail/domain/constants/repository.tokens';
import { OutboxService } from 'src/outbox/application/outbox.service';
import { AuditService } from 'src/audit/application/audit.service';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

describe('ForgotPasswordHandler', () => {
  let handler: ForgotPasswordHandler;

  const userRepository = {
    findByEmailWithoutPassword: jest.fn(),
    setPasswordResetToken: jest.fn(),
  };

  const emailDeliveryRepository = {
    create: jest.fn(),
  };

  const outboxService = {
    create: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForgotPasswordHandler,
        {
          provide: USER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: EMAIL_DELIVERY_REPOSITORY,
          useValue: emailDeliveryRepository,
        },
        {
          provide: OutboxService,
          useValue: outboxService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    handler = module.get<ForgotPasswordHandler>(ForgotPasswordHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('user does not exist', () => {
    it('should return a generic response without revealing whether the account exists', async () => {
      userRepository.findByEmailWithoutPassword.mockResolvedValue(null);

      const command = new ForgotPasswordCommand('unknown@example.com');

      const result = await handler.execute(command);

      expect(result).toEqual({
        message:
          'If an account with that email exists, a password reset email has been sent.',
      });

      expect(userRepository.findByEmailWithoutPassword).toHaveBeenCalledWith(
        'unknown@example.com',
      );

      expect(userRepository.setPasswordResetToken).not.toHaveBeenCalled();
      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();
      expect(outboxService.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('existing user', () => {
    it('should create a password reset token and queue the reset email', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
      };

      userRepository.findByEmailWithoutPassword.mockResolvedValue(user);
      userRepository.setPasswordResetToken.mockResolvedValue(undefined);
      emailDeliveryRepository.create.mockResolvedValue(undefined);
      outboxService.create.mockResolvedValue(undefined);
      auditService.log.mockResolvedValue(undefined);

      const command = new ForgotPasswordCommand('user@example.com');

      const result = await handler.execute(command);

      expect(result).toEqual({
        message:
          'If an account with that email exists, a password reset email has been sent.',
      });

      expect(userRepository.findByEmailWithoutPassword).toHaveBeenCalledWith(
        'user@example.com',
      );

      expect(userRepository.setPasswordResetToken).toHaveBeenCalledTimes(1);

      const [userId, resetTokenHash, resetExpiresAt] =
        userRepository.setPasswordResetToken.mock.calls[0];

      expect(userId).toBe('user-123');
      expect(resetTokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(resetExpiresAt).toBeInstanceOf(Date);

      expect(resetExpiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(emailDeliveryRepository.create).toHaveBeenCalledTimes(1);

      const emailDelivery = emailDeliveryRepository.create.mock.calls[0][0];

      expect(emailDelivery).toMatchObject({
        to: 'user@example.com',
        emailType: 'PASSWORD_RESET',
        status: EmailDeliveryStatus.QUEUED,
      });

      expect(emailDelivery.outboxEventId).toBeDefined();

      expect(outboxService.create).toHaveBeenCalledTimes(1);

      const outboxEvent = outboxService.create.mock.calls[0][0];

      expect(outboxEvent).toMatchObject({
        eventType: 'EMAIL_REQUESTED',
        aggregateType: 'USER',
        aggregateId: 'user-123',
        payload: {
          emailType: 'PASSWORD_RESET',
          to: 'user@example.com',
        },
      });

      expect(outboxEvent.id).toBeDefined();
      expect(outboxEvent.payload.token).toBeDefined();
      expect(outboxEvent.payload.token).toMatch(/^[a-f0-9]{64}$/);
      expect(outboxEvent.payload.expiresAt).toBeInstanceOf(Date);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'AUTH',
      });
    });
  });

  describe('repository failure', () => {
    it('should propagate an error when setting the password reset token fails', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
      };

      userRepository.findByEmailWithoutPassword.mockResolvedValue(user);

      userRepository.setPasswordResetToken.mockRejectedValue(
        new Error('Database error'),
      );

      const command = new ForgotPasswordCommand('user@example.com');

      await expect(handler.execute(command)).rejects.toThrow('Database error');

      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();
      expect(outboxService.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('outbox failure', () => {
    it('should propagate an error when creating the outbox event fails', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
      };

      userRepository.findByEmailWithoutPassword.mockResolvedValue(user);
      userRepository.setPasswordResetToken.mockResolvedValue(undefined);
      emailDeliveryRepository.create.mockResolvedValue(undefined);

      outboxService.create.mockRejectedValue(new Error('Outbox error'));

      const command = new ForgotPasswordCommand('user@example.com');

      await expect(handler.execute(command)).rejects.toThrow('Outbox error');

      expect(emailDeliveryRepository.create).toHaveBeenCalledTimes(1);
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });
});
