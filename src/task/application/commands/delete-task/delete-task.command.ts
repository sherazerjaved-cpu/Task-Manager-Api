export class DeleteTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly userId: string,
    public readonly role: string,
    public readonly workspaceId: string,
  ) {}
}
