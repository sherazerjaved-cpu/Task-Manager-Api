import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import type { IUserRepository } from 'src/users/domain/repositories/user.repository.interface';
import { GetUsersQuery } from './get-users.query';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';

@QueryHandler(GetUsersQuery)
export class GetUsersHandler implements IQueryHandler<GetUsersQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute() {
    return this.userRepository.findAll();
  }
}
