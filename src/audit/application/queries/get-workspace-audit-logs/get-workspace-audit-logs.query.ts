export class GetWorkspaceAuditLogsQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly page: number,
    public readonly limit: number,
  ) {}
}
