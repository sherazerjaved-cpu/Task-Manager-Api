import {
  Post,
  Body,
  Controller,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { RegisterDto } from './DTO/register.dto';
import { LoginDto } from './DTO/login.dto';
import { RefreshTokenDto } from './DTO/refresh_token.dto';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from './application/command/register-user/register-user.command';
import { LoginCommand } from './application/command/login/login.command';
import { RefreshTokenCommand } from './application/command/refresh-token/refresh-token.command';
import { LogoutCommand } from './application/command/logout/logout.command';
import { VerifyEmailCommand } from './application/command/verify-email/verify-email.command';
import { ForgotPasswordCommand } from './application/command/forgot-password/forgot-password.command';
import { ResetPasswordCommand } from './application/command/reset-password/reset-password.command';
import type { Request } from 'express';
import { IdempotencyInterceptor } from 'src/common/idempotency/idempotency.interceptor';
import { ApiIdempotencyKey } from 'src/common/http/api-headers.decorator';
import { ProblemResponses } from 'src/common/http/problem-responses.decorator';

@ApiTags('Authentication')
@ProblemResponses()
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account',
  })
  @ApiIdempotencyKey()
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed.',
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists.',
  })
  @UseInterceptors(IdempotencyInterceptor)
  register(@Body() registerDto: RegisterDto) {
    return this.commandBus.execute(new RegisterUserCommand(registerDto));
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description: 'Authenticates a user and returns access and refresh tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials.',
  })
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.commandBus.execute(
      new LoginCommand(loginDto, request.ip ?? request.socket?.remoteAddress),
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generates a new access token using a valid refresh token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token.',
  })
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.commandBus.execute(new RefreshTokenCommand(refreshTokenDto));
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout',
    description:
      'Logs out the authenticated user by invalidating the stored refresh token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  logout(@Req() req: any) {
    return this.commandBus.execute(new LogoutCommand(req.user.userId));
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-email')
  @ApiOperation({
    summary: 'Verify email address',
    description:
      'Verifies a user email address using a valid verification token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification token.',
  })
  verifyEmail(@Body('token') token: string) {
    return this.commandBus.execute(new VerifyEmailCommand(token));
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a password reset email if an account exists for the supplied email.',
  })
  @ApiResponse({
    status: 200,
    description: 'A password reset email will be sent if the account exists.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed.',
  })
  forgotPassword(@Body('email') email: string) {
    return this.commandBus.execute(new ForgotPasswordCommand(email));
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Resets the account password using a valid, unexpired reset token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired reset token.',
  })
  resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.commandBus.execute(
      new ResetPasswordCommand(token, newPassword),
    );
  }
}
