import { Module, forwardRef } from '@nestjs/common';
import { TaskController } from './task.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './Schema/task.schema';
import {
  Category,
  CategorySchema,
} from 'src/categories/Schema/categories.schema';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { ActivityModule } from 'src/activity/activity.module';
import { TASK_REPOSITORY } from './domain/constants/repository.tokens';
import { TaskRepository } from './infrastructure/persistence/task.repository';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateTaskHandler } from './application/commands/create-task/create-task.handler';
import { GetTasksHandler } from './application/queries/get-tasks/get-tasks.handler';
import { GetTaskByIdHandler } from './application/queries/get-task-by-id/get-task-by-id.handler';
import { UpdateTaskHandler } from './application/commands/update-task/update-task.handler';
import { DeleteTaskHandler } from './application/commands/delete-task/delete-task.handler';
import { UploadAttachmentHandler } from './application/commands/upload-attachment/upload-attachment.handler';
import { FileStorageService } from './infrastructure/storage/file-storage.service';
import { DeleteAttachmentHandler } from './application/commands/delete-attachment/delete-attachment.handler';
import { GetAttachmentsHandler } from './application/queries/get-attachments/get-attachments.handler';
import { CreateCommentHandler } from './application/commands/create-comment/create-comment.handler';
import { GetCommentsHandler } from './application/queries/get-comments/get-comments.handler';
import { GetTaskStatsHandler } from './application/queries/get-task-stats/get-task-stats.handler';
import { TaskCreatedHandler } from './application/events/handlers/task-created.handler';
import { TaskCompletedHandler } from './application/events/handlers/task-completed.handler';
import { CategoriesModule } from 'src/categories/categories.module';
import { AssignTaskHandler } from './application/commands/assign-task/assign-task.handler';
import { WorkspaceModule } from 'src/workspace/workspace.module';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';
import { AuditModule } from 'src/audit/audit.module';
import { AuthModule } from 'src/auth/auth.module';
import { OutboxModule } from 'src/outbox/outbox.module';

const CommandHandlers = [
  CreateTaskHandler,
  UpdateTaskHandler,
  DeleteTaskHandler,
  UploadAttachmentHandler,
  DeleteAttachmentHandler,
  CreateCommentHandler,
  AssignTaskHandler,
];

const QueryHandlers = [
  GetTasksHandler,
  GetTaskByIdHandler,
  GetAttachmentsHandler,
  GetCommentsHandler,
  GetTaskStatsHandler,
];

const EventHandlers = [TaskCreatedHandler, TaskCompletedHandler];

@Module({
  imports: [
    CqrsModule,
    CategoriesModule,
    AuditModule,
    AuthModule,
    forwardRef(() => WorkspaceModule),
    forwardRef(() => OutboxModule),
    AuthorizationModule,
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    WebsocketModule,
    ActivityModule,
  ],
  providers: [
    FileStorageService,
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
    {
      provide: TASK_REPOSITORY,
      useClass: TaskRepository,
    },
    PoliciesGuard,
  ],
  controllers: [TaskController],
  exports: [MongooseModule, TASK_REPOSITORY],
})
export class TaskModule {}
