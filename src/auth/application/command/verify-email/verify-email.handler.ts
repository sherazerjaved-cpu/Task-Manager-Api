import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'crypto';
import { VerifyEmailCommand } from './verify-email.command';
import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler implements ICommandHandler<VerifyEmailCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: VerifyEmailCommand) {
    const { token } = command;

    if (!token) {
      await this.auditService.log({
        action: 'EMAIL_VERIFICATION_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'token_missing',
        },
      });

      throw new BadRequestException('Verification token is required');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository.verifyEmail(tokenHash);

    if (!user) {
      await this.auditService.log({
        action: 'EMAIL_VERIFICATION_FAILED',
        resource: 'AUTH',
        meta: {
          reason: 'invalid_or_expired_token',
        },
      });

      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.auditService.log({
      actorId: user._id.toString(),
      action: 'EMAIL_VERIFIED',
      resource: 'USER',
    });

    return {
      message: 'Email verified successfully',
    };
  }
}
