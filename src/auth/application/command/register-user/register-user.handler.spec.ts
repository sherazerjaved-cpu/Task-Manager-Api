import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

import * as bcrypt from 'bcrypt';
import { RegisterUserHandler } from './register-user.handler';
import { RegisterUserCommand } from './register-user.command';

import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';

import { EMAIL_DELIVERY_REPOSITORY } from 'src/mail/domain/constants/repository.tokens';

import { OutboxService } from 'src/outbox/application/outbox.service';
import { AuditService } from 'src/audit/application/audit.service';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

describe('RegisterUserHandler', () => {
  let handler: RegisterUserHandler;

  let userRepository: {
    findByEmail: jest.Mock;
    createUser: jest.Mock;
  };

  let emailDeliveryRepository: {
    create: jest.Mock;
  };

  let outboxService: {
    create: jest.Mock;
  };

  let auditService: {
    log: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
    };

    emailDeliveryRepository = {
      create: jest.fn(),
    };

    outboxService = {
      create: jest.fn(),
    };

    auditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterUserHandler,
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

    handler = module.get<RegisterUserHandler>(RegisterUserHandler);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('successful registration', () => {
    it('should register the user and create verification email/outbox records', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
        email: 'john@example.com',
        password: 'hashed-password',
        emailVerified: false,
      };

      userRepository.findByEmail.mockResolvedValue(null);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      userRepository.createUser.mockResolvedValue(user);

      emailDeliveryRepository.create.mockResolvedValue({
        _id: 'delivery-123',
      });

      outboxService.create.mockResolvedValue({
        id: expect.any(String),
      });

      const command = new RegisterUserCommand({
        email: 'john@example.com',
        password: 'Password123!',
      });

      const result = await handler.execute(command);

      expect(result).toBe(user);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        'john@example.com',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);

      expect(userRepository.createUser).toHaveBeenCalledWith(
        'john@example.com',
        'hashed-password',
        expect.any(String),
        expect.any(Date),
      );

      expect(emailDeliveryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          emailType: 'EMAIL_VERIFICATION',
          status: EmailDeliveryStatus.QUEUED,
          outboxEventId: expect.any(Object),
        }),
      );

      expect(outboxService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EMAIL_REQUESTED',
          aggregateType: 'USER',
          aggregateId: 'user-123',
          payload: expect.objectContaining({
            emailType: 'EMAIL_VERIFICATION',
            to: 'john@example.com',
            token: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'USER_REGISTERED',
        resource: 'USER',
      });
    });
  });

  describe('duplicate email', () => {
    it('should reject registration when the email is already registered', async () => {
      const existingUser = {
        _id: {
          toString: () => 'existing-user',
        },
        email: 'john@example.com',
      };

      userRepository.findByEmail.mockResolvedValue(existingUser);

      const command = new RegisterUserCommand({
        email: 'john@example.com',
        password: 'Password123!',
      });

      await expect(handler.execute(command)).rejects.toThrow(ConflictException);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        'john@example.com',
      );

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(userRepository.createUser).not.toHaveBeenCalled();
      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();
      expect(outboxService.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('verification token', () => {
    it('should create a hashed verification token and expiration time', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
        email: 'john@example.com',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userRepository.createUser.mockResolvedValue(user);

      const command = new RegisterUserCommand({
        email: 'john@example.com',
        password: 'Password123!',
      });

      await handler.execute(command);

      const createUserCall = userRepository.createUser.mock.calls[0];

      expect(createUserCall[2]).toEqual(expect.any(String));
      expect(createUserCall[2]).toHaveLength(64);

      expect(createUserCall[3]).toEqual(expect.any(Date));

      const expiresAt = createUserCall[3] as Date;

      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('verification email workflow', () => {
    it('should queue email delivery before creating the outbox event', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
        email: 'john@example.com',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userRepository.createUser.mockResolvedValue(user);

      const callOrder: string[] = [];

      emailDeliveryRepository.create.mockImplementation(async () => {
        callOrder.push('email-delivery');
      });

      outboxService.create.mockImplementation(async () => {
        callOrder.push('outbox');
      });

      const command = new RegisterUserCommand({
        email: 'john@example.com',
        password: 'Password123!',
      });

      await handler.execute(command);

      expect(callOrder).toEqual(['email-delivery', 'outbox']);
    });
  });
});
