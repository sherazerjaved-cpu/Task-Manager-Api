import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { RefreshTokenCommand } from './refresh-token.command';
import { TokenService } from 'src/auth/services/token.service';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    private readonly tokenService: TokenService,

    private readonly jwtService: JwtService,

    private readonly configService: ConfigService,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: RefreshTokenCommand) {
    const { refresh_token } = command.dto;

    let payload: any;

    try {
      payload = this.jwtService.verify(refresh_token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      await this.auditService.log({
        action: 'REFRESH_TOKEN_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'invalid_token',
        },
      });

      throw new UnauthorizedException('Invalid refresh Token');
    }

    const user = await this.userRepository.findByIdWithRefreshToken(
      payload.sub,
    );

    if (!user || !user.refreshTokenHash) {
      await this.auditService.log({
        action: 'REFRESH_TOKEN_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'refresh_token_not_found',
        },
      });

      throw new UnauthorizedException('Refresh Token Not Found');
    }

    if (payload.family !== user.tokenFamily) {
      await this.auditService.log({
        actorId: user._id.toString(),
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        resource: 'AUTH',
        meta: {
          reason: 'token_family_mismatch',
        },
      });

      await this.userRepository.clearRefreshToken(user._id.toString());

      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (payload.jti !== user.currentTokenId) {
      await this.auditService.log({
        actorId: user._id.toString(),
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        resource: 'AUTH',
        meta: {
          reason: 'token_id_mismatch',
        },
      });

      await this.userRepository.clearRefreshToken(user._id.toString());

      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const isValid = await bcrypt.compare(refresh_token, user.refreshTokenHash);

    if (!isValid) {
      await this.auditService.log({
        actorId: user._id.toString(),
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        resource: 'AUTH',
        meta: {
          reason: 'token_hash_mismatch',
        },
      });

      await this.userRepository.clearRefreshToken(user._id.toString());

      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const accessToken = await this.tokenService.generateAccessToken(user);

    const newTokenId = randomUUID();

    const newRefreshToken = await this.tokenService.generateRefreshToken(
      user,
      user.tokenFamily!,
      newTokenId,
    );

    const refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    await this.userRepository.updateRefreshToken(
      user._id.toString(),
      refreshTokenHash,
      user.tokenFamily!,
      newTokenId,
    );

    await this.auditService.log({
      actorId: user._id.toString(),
      action: 'REFRESH_TOKEN_SUCCESS',
      resource: 'AUTH',
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
    };
  }
}
