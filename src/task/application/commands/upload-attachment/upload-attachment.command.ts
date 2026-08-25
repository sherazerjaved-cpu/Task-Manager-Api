import { Express } from 'express';

export class UploadAttachmentCommand {
  constructor(
    public readonly taskId: string,
    public readonly file: Express.Multer.File,
    public readonly userId: string,
    public readonly role: string,
    public readonly workspaceId: string,
  ) {}
}
