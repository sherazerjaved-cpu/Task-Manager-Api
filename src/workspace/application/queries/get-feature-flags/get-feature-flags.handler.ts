import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetFeatureFlagsQuery } from './get-feature-flags.query';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { WorkspaceFeatureFlag } from '../../../domain/enums/workspace-feature-flag.enum';

@QueryHandler(GetFeatureFlagsQuery)
export class GetFeatureFlagsHandler implements IQueryHandler<GetFeatureFlagsQuery> {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  async execute(
    query: GetFeatureFlagsQuery,
  ): Promise<Record<WorkspaceFeatureFlag, boolean>> {
    return this.featureFlagsService.getFlags(query.workspaceId);
  }
}
