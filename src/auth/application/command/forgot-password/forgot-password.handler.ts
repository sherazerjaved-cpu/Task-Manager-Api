import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Types } from 'mongoose';

import { ForgotPasswordCommand } from './forgot-password.command';

import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';

import { AuditService } from 'src/audit/application/audit.service';
import { OutboxService } from 'src/outbox/application/outbox.service';

import { EMAIL_DELIVERY_REPOSITORY } from 'src/mail/domain/constants/repository.tokens';
import type { IEmailDeliveryRepository } from 'src/mail/domain/repositories/email-delivery.repository.interface';

import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler implements ICommandHandler<ForgotPasswordCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    @Inject(EMAIL_DELIVERY_REPOSITORY)
    private readonly emailDeliveryRepository: IEmailDeliveryRepository,

    private readonly outboxService: OutboxService,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: ForgotPasswordCommand) {
    const { email } = command;

    const user = await this.userRepository.findByEmailWithoutPassword(email);

    if (!user) {
      return {
        message:
          'If an account with that email exists, a password reset email has been sent.',
      };
    }

    const resetToken = randomBytes(32).toString('hex');

    const resetTokenHash = createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.userRepository.setPasswordResetToken(
      user._id.toString(),
      resetTokenHash,
      resetExpiresAt,
    );

    const outboxEventId = new Types.ObjectId();

    await this.emailDeliveryRepository.create({
      outboxEventId,
      to: email,
      emailType: 'PASSWORD_RESET',
      status: EmailDeliveryStatus.QUEUED,
    });

    await this.outboxService.create({
      id: outboxEventId.toString(),
      eventType: 'EMAIL_REQUESTED',
      aggregateType: 'USER',
      aggregateId: user._id.toString(),
      payload: {
        emailType: 'PASSWORD_RESET',
        to: email,
        token: resetToken,
        expiresAt: resetExpiresAt,
      },
    });

    await this.auditService.log({
      actorId: user._id.toString(),
      action: 'PASSWORD_RESET_REQUESTED',
      resource: 'AUTH',
    });

    return {
      message:
        'If an account with that email exists, a password reset email has been sent.',
    };
  }
}
