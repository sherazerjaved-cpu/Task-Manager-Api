import { GetTasksQueryDto } from 'src/task/DTO/get-task-query.dto';

export class GetTasksQuery {
  constructor(
    public readonly userId: string,
    public readonly role: string,
    public readonly workspaceId: string,
    public readonly query: GetTasksQueryDto,
  ) {}
}
