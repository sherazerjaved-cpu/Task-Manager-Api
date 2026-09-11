import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetWorkspaceMembersQuery } from './get-workspace-members.query';
import { MEMBERSHIP_REPOSITORY } from '../../../domain/repositories/membership.repository.interface';
import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';
import { MembershipStatus } from '../../../domain/enums/membership-status.enum';

@QueryHandler(GetWorkspaceMembersQuery)
export class GetWorkspaceMembersHandler implements IQueryHandler<GetWorkspaceMembersQuery> {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,
  ) {}

  async execute(query: GetWorkspaceMembersQuery) {
    const membership = await this.membershipRepository.findByWorkspaceAndUser(
      query.workspaceId,
      query.userId,
    );

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException('Workspace not found');
    }

    return this.membershipRepository.findByWorkspace(query.workspaceId);
  }
}
