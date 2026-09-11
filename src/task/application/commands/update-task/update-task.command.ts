import { UpdateTaskDto } from 'src/task/DTO/update-task.dto';

export class UpdateTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly updateTaskDto: UpdateTaskDto,
    public readonly userId: string,
    public readonly role: string,
    public readonly workspaceId: string,
    public readonly expectedVersion: number,
  ) {}
}
