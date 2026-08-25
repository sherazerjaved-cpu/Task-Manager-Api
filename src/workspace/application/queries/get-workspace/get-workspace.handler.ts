import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetWorkspaceQuery } from './get-workspace.query';
import { MembershipStatus } from '../../../domain/enums/membership-status.enum';
import {
  WORKSPACE_REPOSITORY,
  type IWorkspaceRepository,
} from '../../../domain/repositories/workspace.repository.interface';

import {
  MEMBERSHIP_REPOSITORY,
  type IMembershipRepository,
} from '../../../domain/repositories/membership.repository.interface';

@QueryHandler(GetWorkspaceQuery)
export class GetWorkspaceHandler implements IQueryHandler<GetWorkspaceQuery> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,
  ) {}

  async execute(query: GetWorkspaceQuery) {
    const membership = await this.membershipRepository.findByWorkspaceAndUser(
      query.workspaceId,
      query.userId,
    );

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException('Workspace not found');
    }

    const workspace = await this.workspaceRepository.findById(
      query.workspaceId,
    );

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }
}
