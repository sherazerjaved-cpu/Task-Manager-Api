export class GetWorkspaceQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
  ) {}
}
