import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPendingInvitationsQuery } from './get-pending-invitations.query';
import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository.interface';
import type { IInvitationRepository } from '../../../domain/repositories/invitation.repository.interface';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import type { IUserRepository } from '../../../../users/domain/repositories/user.repository.interface';

@QueryHandler(GetPendingInvitationsQuery)
export class GetPendingInvitationsHandler implements IQueryHandler<GetPendingInvitationsQuery> {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,

    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetPendingInvitationsQuery) {
    const user = await this.userRepository.findById(query.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.invitationRepository.findPendingByEmail(user.email);
  }
}
