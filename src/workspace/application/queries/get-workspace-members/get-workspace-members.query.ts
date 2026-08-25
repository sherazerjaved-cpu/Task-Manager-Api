export class GetWorkspaceMembersQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
  ) {}
}
