import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { VerifyEmailHandler } from './verify-email.handler';
import { VerifyEmailCommand } from './verify-email.command';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { AuditService } from 'src/audit/application/audit.service';
import { createHash } from 'crypto';

describe('VerifyEmailHandler', () => {
  let handler: VerifyEmailHandler;

  const userRepository = {
    verifyEmail: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyEmailHandler,
        {
          provide: USER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    handler = module.get<VerifyEmailHandler>(VerifyEmailHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('successful verification', () => {
    it('should verify the email and return success message', async () => {
      const token = 'verification-token-123';

      const user = {
        _id: {
          toString: () => 'user-123',
        },
      };

      const expectedTokenHash = createHash('sha256')
        .update(token)
        .digest('hex');

      userRepository.verifyEmail.mockResolvedValue(user);
      auditService.log.mockResolvedValue(undefined);

      const command = new VerifyEmailCommand(token);

      const result = await handler.execute(command);

      expect(userRepository.verifyEmail).toHaveBeenCalledTimes(1);
      expect(userRepository.verifyEmail).toHaveBeenCalledWith(
        expectedTokenHash,
      );

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'EMAIL_VERIFIED',
        resource: 'USER',
      });

      expect(result).toEqual({
        message: 'Email verified successfully',
      });
    });
  });

  describe('missing token', () => {
    it('should reject verification when token is missing', async () => {
      const command = new VerifyEmailCommand('');

      auditService.log.mockResolvedValue(undefined);

      await expect(handler.execute(command)).rejects.toThrow(
        new BadRequestException('Verification token is required'),
      );

      expect(userRepository.verifyEmail).not.toHaveBeenCalled();

      expect(auditService.log).toHaveBeenCalledWith({
        action: 'EMAIL_VERIFICATION_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'token_missing',
        },
      });
    });
  });

  describe('invalid or expired token', () => {
    it('should reject verification when repository returns no user', async () => {
      const token = 'invalid-token';

      const expectedTokenHash = createHash('sha256')
        .update(token)
        .digest('hex');

      userRepository.verifyEmail.mockResolvedValue(null);
      auditService.log.mockResolvedValue(undefined);

      const command = new VerifyEmailCommand(token);

      await expect(handler.execute(command)).rejects.toThrow(
        new BadRequestException('Invalid or expired verification token'),
      );

      expect(userRepository.verifyEmail).toHaveBeenCalledWith(
        expectedTokenHash,
      );

      expect(auditService.log).toHaveBeenCalledWith({
        action: 'EMAIL_VERIFICATION_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'invalid_or_expired_token',
        },
      });
    });
  });

  describe('audit logging', () => {
    it('should propagate an audit logging error after successful verification', async () => {
      const token = 'verification-token-123';

      const user = {
        _id: {
          toString: () => 'user-123',
        },
      };

      userRepository.verifyEmail.mockResolvedValue(user);

      const error = new Error('Audit service error');
      auditService.log.mockRejectedValue(error);

      const command = new VerifyEmailCommand(token);

      await expect(handler.execute(command)).rejects.toThrow(
        'Audit service error',
      );

      expect(userRepository.verifyEmail).toHaveBeenCalledTimes(1);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'EMAIL_VERIFIED',
        resource: 'USER',
      });
    });
  });
});
