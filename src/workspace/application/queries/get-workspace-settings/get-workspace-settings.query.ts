export class GetWorkspaceSettingsQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
  ) {}
}
