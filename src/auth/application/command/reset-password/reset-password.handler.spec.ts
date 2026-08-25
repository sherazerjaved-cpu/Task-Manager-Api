jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { ResetPasswordHandler } from './reset-password.handler';
import { ResetPasswordCommand } from './reset-password.command';

import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { AuditService } from 'src/audit/application/audit.service';

describe('ResetPasswordHandler', () => {
  let handler: ResetPasswordHandler;

  let userRepository: {
    findByPasswordResetToken: jest.Mock;
    updatePassword: jest.Mock;
    clearPasswordResetToken: jest.Mock;
    clearRefreshToken: jest.Mock;
  };

  let auditService: {
    log: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findByPasswordResetToken: jest.fn(),
      updatePassword: jest.fn(),
      clearPasswordResetToken: jest.fn(),
      clearRefreshToken: jest.fn(),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordHandler,
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

    handler = module.get<ResetPasswordHandler>(ResetPasswordHandler);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('missing token', () => {
    it('should reject when reset token is missing', async () => {
      const command = new ResetPasswordCommand('', 'NewPassword123!');

      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );

      expect(userRepository.findByPasswordResetToken).not.toHaveBeenCalled();

      expect(auditService.log).toHaveBeenCalledWith({
        action: 'PASSWORD_RESET_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'missing_token',
        },
      });
    });
  });

  describe('invalid or expired token', () => {
    it('should reject when reset token is invalid or expired', async () => {
      userRepository.findByPasswordResetToken.mockResolvedValue(null);

      const command = new ResetPasswordCommand(
        'invalid-token',
        'NewPassword123!',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );

      expect(userRepository.findByPasswordResetToken).toHaveBeenCalledTimes(1);

      expect(auditService.log).toHaveBeenCalledWith({
        action: 'PASSWORD_RESET_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'invalid_or_expired_token',
        },
      });

      expect(userRepository.updatePassword).not.toHaveBeenCalled();
      expect(userRepository.clearPasswordResetToken).not.toHaveBeenCalled();
      expect(userRepository.clearRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('successful password reset', () => {
    it('should reset the password and invalidate reset and refresh tokens', async () => {
      const user = {
        _id: {
          toString: () => 'user-123',
        },
      };

      userRepository.findByPasswordResetToken.mockResolvedValue(user);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');

      const command = new ResetPasswordCommand(
        'valid-reset-token',
        'NewPassword123!',
      );

      const result = await handler.execute(command);

      expect(result).toEqual({
        message: 'Password reset successfully',
      });

      expect(userRepository.findByPasswordResetToken).toHaveBeenCalledTimes(1);

      expect(userRepository.updatePassword).toHaveBeenCalledWith(
        'user-123',
        'hashed-new-password',
      );

      expect(userRepository.clearPasswordResetToken).toHaveBeenCalledWith(
        'user-123',
      );

      expect(userRepository.clearRefreshToken).toHaveBeenCalledWith('user-123');

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'PASSWORD_RESET_COMPLETED',
        resource: 'USER',
      });
    });
  });

  describe('security behavior', () => {
    it('should clear the refresh token after a successful password reset', async () => {
      const user = {
        _id: {
          toString: () => 'user-456',
        },
      };

      userRepository.findByPasswordResetToken.mockResolvedValue(user);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const command = new ResetPasswordCommand(
        'valid-token',
        'AnotherPassword123!',
      );

      await handler.execute(command);

      expect(userRepository.clearRefreshToken).toHaveBeenCalledWith('user-456');
    });
  });
});
