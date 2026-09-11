import { TaskDocument } from 'src/task/Schema/task.schema';
import { CreateTaskDto } from 'src/task/DTO/create-task.dto';
import { UpdateTaskDto } from 'src/task/DTO/update-task.dto';
import { GetTasksQueryDto } from 'src/task/DTO/get-task-query.dto';
import { CreateCommentDto } from 'src/task/DTO/create-comment.dto';
import { ClientSession } from 'mongoose';

export interface ITaskRepository {
  create(
    createTaskDto: CreateTaskDto,
    ownerId: string,
    session?: ClientSession,
  ): Promise<TaskDocument>;

  findAll(
    userId: string,
    role: string,
    workspaceId: string,
    query: GetTasksQueryDto,
  ): Promise<unknown>;

  findById(id: string, workspaceId: string): Promise<TaskDocument | null>;

  assignUsers(taskId: string, userIds: string[]): Promise<TaskDocument>;

  findAuthorizedTask(
    id: string,
    userId: string,
    role: string,
    workspaceId: string,
  ): Promise<TaskDocument>;

  uploadAttachment(
    taskId: string,
    file: Express.Multer.File,
  ): Promise<TaskDocument>;

  deleteAttachment(taskId: string, attachmentId: string): Promise<TaskDocument>;

  getAttachments(taskId: string): Promise<TaskDocument>;

  update(
    id: string,
    workspaceId: string,
    updateTaskDto: UpdateTaskDto,
  ): Promise<TaskDocument | null>;

  addComment(
    taskId: string,
    createCommentDto: CreateCommentDto,
    userId: string,
  ): Promise<TaskDocument>;

  getComments(taskId: string): Promise<TaskDocument>;

  getStats(userId: string, role: string): Promise<unknown>;

  aggregateWorkspaceTasks(
    workspaceId: string,
    page: number,
    limit: number,
    status?: string,
    search?: string,
  ): Promise<{
    data: any[];
    total: number;
    stats: any;
  }>;

  findAllForExport(workspaceId: string): Promise<any[]>;

  delete(id: string, workspaceId: string): Promise<void>;

  save(task: TaskDocument): Promise<TaskDocument>;

  clearCache(): Promise<void>;
}
