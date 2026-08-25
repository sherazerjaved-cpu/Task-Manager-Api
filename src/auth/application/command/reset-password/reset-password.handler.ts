import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ResetPasswordCommand } from './reset-password.command';
import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: ResetPasswordCommand) {
    const { token, newPassword } = command;

    if (!token) {
      await this.auditService.log({
        action: 'PASSWORD_RESET_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'missing_token',
        },
      });

      throw new BadRequestException('Password reset token is required');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository.findByPasswordResetToken(tokenHash);

    if (!user) {
      await this.auditService.log({
        action: 'PASSWORD_RESET_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'invalid_or_expired_token',
        },
      });

      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.userRepository.updatePassword(user._id.toString(), passwordHash);

    await this.userRepository.clearPasswordResetToken(user._id.toString());

    await this.userRepository.clearRefreshToken(user._id.toString());

    await this.auditService.log({
      actorId: user._id.toString(),
      action: 'PASSWORD_RESET_COMPLETED',
      resource: 'USER',
    });

    return {
      message: 'Password reset successfully',
    };
  }
}
