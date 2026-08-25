import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { LogoutCommand } from './logout.command';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { AuditService } from 'src/audit/application/audit.service';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    private readonly auditService: AuditService,
  ) {}

  async execute(command: LogoutCommand) {
    await this.userRepository.clearRefreshToken(command.userId);

    await this.auditService.log({
      actorId: command.userId,
      action: 'LOGOUT_SUCCESS',
      resource: 'AUTH',
    });

    return {
      message: 'Logged out successfully',
    };
  }
}
