import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { RegisterUserCommand } from './register-user.command';
import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { AuditService } from 'src/audit/application/audit.service';
import { OutboxService } from 'src/outbox/application/outbox.service';
import { EMAIL_DELIVERY_REPOSITORY } from 'src/mail/domain/constants/repository.tokens';
import type { IEmailDeliveryRepository } from 'src/mail/domain/repositories/email-delivery.repository.interface';
import { Types } from 'mongoose';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    @Inject(EMAIL_DELIVERY_REPOSITORY)
    private readonly emailDeliveryRepository: IEmailDeliveryRepository,

    private readonly outboxService: OutboxService,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: RegisterUserCommand) {
    const { email, password } = command.dto;

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = randomBytes(32).toString('hex');

    const verificationTokenHash = createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    const verificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const user = await this.userRepository.createUser(
      email,
      hashedPassword,
      verificationTokenHash,
      verificationExpiresAt,
    );

    const outboxEventId = new Types.ObjectId();

    await this.emailDeliveryRepository.create({
      outboxEventId,
      to: email,
      emailType: 'EMAIL_VERIFICATION',
      status: EmailDeliveryStatus.QUEUED,
    });

    await this.outboxService.create({
      id: outboxEventId.toString(),
      eventType: 'EMAIL_REQUESTED',
      aggregateType: 'USER',
      aggregateId: user._id.toString(),
      payload: {
        emailType: 'EMAIL_VERIFICATION',
        to: email,
        token: verificationToken,
        expiresAt: verificationExpiresAt,
      },
    });

    await this.auditService.log({
      actorId: user._id.toString(),
      action: 'USER_REGISTERED',
      resource: 'USER',
    });

    return user;
  }
}
