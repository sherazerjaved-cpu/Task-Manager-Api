import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './Schema/user.schema';
import { UsersController } from './users.controller';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { CqrsModule } from '@nestjs/cqrs';
import { DeleteUserHandler } from './application/commands/delete-user/delete-user.handler';
import { GetUsersHandler } from './application/queries/get-users/get-users.handler';
import { USER_REPOSITORY } from './domain/constants/repository.tokens';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [
    UserRepository,
    {
      provide: USER_REPOSITORY,
      useExisting: UserRepository,
    },
    DeleteUserHandler,
    GetUsersHandler,
  ],
  controllers: [UsersController],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
