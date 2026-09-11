import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { Inject, NotFoundException } from '@nestjs/common';
import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { DeleteUserCommand } from './delete-user.command';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: DeleteUserCommand) {
    const user = await this.userRepository.deleteUser(command.userId);

    if (!user) {
      throw new NotFoundException('User Not Found');
    }

    return {
      message: 'User Deleted Successfully',
    };
  }
}
