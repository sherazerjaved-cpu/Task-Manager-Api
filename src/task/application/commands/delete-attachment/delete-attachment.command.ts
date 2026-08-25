export class DeleteAttachmentCommand {
  constructor(
    public readonly taskId: string,
    public readonly attachmentId: string,
    public readonly userId: string,
    public readonly role: string,
    public readonly workspaceId: string,
  ) {}
}
