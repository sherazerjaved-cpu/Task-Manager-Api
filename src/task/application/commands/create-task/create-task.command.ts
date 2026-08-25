import { CreateTaskDto } from 'src/task/DTO/create-task.dto';

export class CreateTaskCommand {
  constructor(
    public readonly createTaskDto: CreateTaskDto,
    public readonly userId: string,
  ) {}
}
