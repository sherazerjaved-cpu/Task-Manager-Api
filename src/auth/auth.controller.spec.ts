import { CommandBus } from '@nestjs/cqrs';
import { AuthController } from './auth.controller';

import { RegisterUserCommand } from './application/command/register-user/register-user.command';
import { LoginCommand } from './application/command/login/login.command';
import { RefreshTokenCommand } from './application/command/refresh-token/refresh-token.command';
import { LogoutCommand } from './application/command/logout/logout.command';
import { VerifyEmailCommand } from './application/command/verify-email/verify-email.command';
import { ForgotPasswordCommand } from './application/command/forgot-password/forgot-password.command';
import { ResetPasswordCommand } from './application/command/reset-password/reset-password.command';

describe('AuthController', () => {
  let controller: AuthController;
  let commandBus: {
    execute: jest.Mock;
  };

  beforeEach(() => {
    commandBus = {
      execute: jest.fn(),
    };

    controller = new AuthController(commandBus as unknown as CommandBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should execute RegisterUserCommand with the register DTO', async () => {
      const registerDto = {
        email: 'john@example.com',
        password: 'Password123',
      };

      const result = { userId: 'user-id' };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.register(registerDto);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new RegisterUserCommand(registerDto),
      );
      expect(response).toEqual(result);
    });
  });

  describe('login', () => {
    it('should execute LoginCommand with DTO and request IP', async () => {
      const loginDto = {
        email: 'john@example.com',
        password: 'Password123',
      };

      const request = {
        ip: '192.168.1.10',
        socket: {
          remoteAddress: '127.0.0.1',
        },
      } as any;

      const result = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.login(loginDto, request);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new LoginCommand(loginDto, '192.168.1.10'),
      );
      expect(response).toEqual(result);
    });

    it('should use socket remote address when request IP is unavailable', async () => {
      const loginDto = {
        email: 'john@example.com',
        password: 'Password123',
      };

      const request = {
        ip: undefined,
        socket: {
          remoteAddress: '127.0.0.1',
        },
      } as any;

      commandBus.execute.mockResolvedValue({});

      await controller.login(loginDto, request);

      expect(commandBus.execute).toHaveBeenCalledWith(
        new LoginCommand(loginDto, '127.0.0.1'),
      );
    });

    it('should pass undefined when both IP addresses are unavailable', async () => {
      const loginDto = {
        email: 'john@example.com',
        password: 'Password123',
      };

      const request = {
        ip: undefined,
        socket: {},
      } as any;

      commandBus.execute.mockResolvedValue({});

      await controller.login(loginDto, request);

      expect(commandBus.execute).toHaveBeenCalledWith(
        new LoginCommand(loginDto, undefined),
      );
    });
  });

  describe('refresh', () => {
    it('should execute RefreshTokenCommand with the refresh token DTO', async () => {
      const refreshTokenDto = {
        refresh_token: 'refresh-token',
      };

      const result = {
        accessToken: 'new-access-token',
      };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.refresh(refreshTokenDto);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new RefreshTokenCommand(refreshTokenDto),
      );
      expect(response).toEqual(result);
    });
  });

  describe('logout', () => {
    it('should execute LogoutCommand with the authenticated user ID', async () => {
      const request = {
        user: {
          userId: 'user-123',
        },
      };

      const result = { message: 'Logged out successfully' };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.logout(request);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new LogoutCommand('user-123'),
      );
      expect(response).toEqual(result);
    });
  });

  describe('verifyEmail', () => {
    it('should execute VerifyEmailCommand with the verification token', async () => {
      const token = 'verification-token';

      const result = { message: 'Email verified successfully' };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.verifyEmail(token);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new VerifyEmailCommand(token),
      );
      expect(response).toEqual(result);
    });
  });

  describe('forgotPassword', () => {
    it('should execute ForgotPasswordCommand with the email', async () => {
      const email = 'john@example.com';

      const result = {
        message: 'Password reset email sent',
      };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.forgotPassword(email);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new ForgotPasswordCommand(email),
      );
      expect(response).toEqual(result);
    });
  });

  describe('resetPassword', () => {
    it('should execute ResetPasswordCommand with token and new password', async () => {
      const token = 'reset-token';
      const newPassword = 'NewPassword123';

      const result = {
        message: 'Password reset successfully',
      };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.resetPassword(token, newPassword);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new ResetPasswordCommand(token, newPassword),
      );
      expect(response).toEqual(result);
    });
  });
});
