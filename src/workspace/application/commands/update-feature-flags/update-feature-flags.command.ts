import { UpdateFeatureFlagsDto } from '../../dto/update-feature-flags.dto';

export class UpdateFeatureFlagsCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly dto: UpdateFeatureFlagsDto,
  ) {}
}
