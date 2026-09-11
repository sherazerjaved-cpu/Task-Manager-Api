import { CreateCommentDto } from 'src/task/DTO/create-comment.dto';

export class CreateCommentCommand {
  constructor(
    public readonly taskId: string,
    public readonly createCommentDto: CreateCommentDto,
    public readonly userId: string,
    public readonly role: string,
    public readonly workspaceId: string,
  ) {}
}
