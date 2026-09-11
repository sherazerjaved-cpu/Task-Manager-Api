import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetWorkspacesQuery } from './get-workspaces.query';
import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository.interface';
import { MEMBERSHIP_REPOSITORY } from '../../../domain/repositories/membership.repository.interface';
import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';

@QueryHandler(GetWorkspacesQuery)
export class GetWorkspacesHandler implements IQueryHandler<GetWorkspacesQuery> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,
  ) {}

  async execute(query: GetWorkspacesQuery) {
    const memberships = await this.membershipRepository.findByUser(
      query.userId,
    );

    const workspaceIds = memberships.map((membership) =>
      membership.workspaceId.toString(),
    );

    if (workspaceIds.length === 0) {
      return [];
    }

    return this.workspaceRepository.findByIds(workspaceIds);
  }
}
