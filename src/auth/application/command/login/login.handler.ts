import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { LoginCommand } from './login.command';
import { TokenService } from 'src/auth/services/token.service';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { BruteForceService } from 'src/auth/services/brute-force.service';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    private readonly tokenService: TokenService,

    private readonly bruteForceService: BruteForceService,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: LoginCommand) {
    const { email, password } = command.dto;
    const ip = command.ip;

    if (await this.bruteForceService.isBlocked(email)) {
      await this.auditService.log({
        action: 'LOGIN_BLOCKED',
        resource: 'AUTH',
        ip,
        meta: {
          reason: 'brute_force_protection',
        },
      });

      throw new UnauthorizedException(
        'Too many failed login attempts. Please try again later.',
      );
    }

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      await this.bruteForceService.recordFailure(email);

      await this.auditService.log({
        action: 'LOGIN_FAILED',
        resource: 'AUTH',
        ip,
        meta: {
          reason: 'invalid_credentials',
        },
      });

      throw new UnauthorizedException('Invalid Credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await this.bruteForceService.recordFailure(email);

      await this.auditService.log({
        actorId: user._id.toString(),
        action: 'LOGIN_FAILED',
        resource: 'AUTH',
        ip,
        meta: {
          reason: 'invalid_credentials',
        },
      });

      throw new UnauthorizedException('Invalid Credentials');
    }

    if (!user.emailVerified) {
      await this.auditService.log({
        actorId: user._id.toString(),
        action: 'LOGIN_BLOCKED',
        resource: 'AUTH',
        ip,
        meta: {
          reason: 'email_not_verified',
        },
      });

      throw new ForbiddenException(
        'Please verify your email before logging in',
      );
    }

    await this.bruteForceService.reset(email);

    const tokenFamily = randomUUID();

    const tokenId = randomUUID();

    const accessToken = await this.tokenService.generateAccessToken(user);

    const refreshToken = await this.tokenService.generateRefreshToken(
      user,
      tokenFamily,
      tokenId,
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.userRepository.updateRefreshToken(
      user._id.toString(),
      refreshTokenHash,
      tokenFamily,
      tokenId,
    );

    await this.auditService.log({
      actorId: user._id.toString(),
      action: 'LOGIN_SUCCESS',
      resource: 'AUTH',
      ip,
      meta: {
        method: 'password',
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
