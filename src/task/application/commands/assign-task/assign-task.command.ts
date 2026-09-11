import { AssignTaskDto } from 'src/task/DTO/assign-task.dto';

export class AssignTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly userId: string,
    public readonly workspaceId: string,
    public readonly assignTaskDto: AssignTaskDto,
  ) {}
}
