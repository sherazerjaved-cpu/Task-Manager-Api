import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Headers,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { CreateTaskDto } from './DTO/create-task.dto';
import { UpdateTaskDto } from './DTO/update-task.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateCommentDto } from './DTO/create-comment.dto';
import { GetTasksQueryDto } from './DTO/get-task-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CommandBus } from '@nestjs/cqrs';
import { CreateTaskCommand } from './application/commands/create-task/create-task.command';
import { QueryBus } from '@nestjs/cqrs';
import { GetTasksQuery } from './application/queries/get-tasks/get-tasks.query';
import { GetTaskByIdQuery } from './application/queries/get-task-by-id/get-task-by-id.query';
import { UpdateTaskCommand } from './application/commands/update-task/update-task.command';
import { DeleteTaskCommand } from './application/commands/delete-task/delete-task.command';
import { UploadAttachmentCommand } from './application/commands/upload-attachment/upload-attachment.command';
import { DeleteAttachmentCommand } from './application/commands/delete-attachment/delete-attachment.command';
import { GetAttachmentsQuery } from './application/queries/get-attachments/get-attachments.query';
import { CreateCommentCommand } from './application/commands/create-comment/create-comment.command';
import { GetCommentsQuery } from './application/queries/get-comments/get-comments.query';
import { GetTaskStatsQuery } from './application/queries/get-task-stats/get-task-stats.query';
import { GetTaskActivitiesQuery } from 'src/activity/application/queries/get-task-activities/get-task-activities.query';
import { AssignTaskCommand } from './application/commands/assign-task/assign-task.command';
import { AssignTaskDto } from './DTO/assign-task.dto';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';
import { CheckPolicies } from 'src/common/authorization/check-policies.decorator';
import { updateTaskPolicy } from 'src/common/authorization/policies/update-task.policy';
import { deleteTaskPolicy } from 'src/common/authorization/policies/delete-task.policy';
import { readTaskPolicy } from 'src/common/authorization/policies/read-task.policy';
import { createCommentPolicy } from 'src/common/authorization/policies/create-comment.policy';
import { readCommentPolicy } from 'src/common/authorization/policies/read-comment.policy';
import { manageAttachmentPolicy } from 'src/common/authorization/policies/manage-attachment.policy';
import { readAttachmentPolicy } from 'src/common/authorization/policies/read-attachment.policy';
import { assignTaskPolicy } from 'src/common/authorization/policies/assign-task.policy';
import { createTaskPolicy } from 'src/common/authorization/policies/create-task.policy';
import { LoadTask } from 'src/common/authorization/check-policies.decorator';
import { UserRateLimitInterceptor } from 'src/auth/interceptors/user-rate-limit.interceptor';
import { parseIfMatch } from 'src/common/http/parse-if-match';
import type { Response } from 'express';
import { parseIfNoneMatch } from 'src/common/http/parse-if-none-match';
import { IdempotencyInterceptor } from 'src/common/idempotency/idempotency.interceptor';
import { ProblemResponses } from 'src/common/http/problem-responses.decorator';
import {
  ApiIdempotencyKey,
  ApiIfMatch,
  ApiIfNoneMatch,
} from 'src/common/http/api-headers.decorator';
import { TaskResponseDto } from './DTO/task-response.dto';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@ProblemResponses()
@UseGuards(JwtAuthGuard)
@UseInterceptors(UserRateLimitInterceptor)
@Controller({ path: 'tasks', version: '1' })
export class TaskController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiOperation({
    summary: 'Create a new task',
  })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully.',
    type: TaskResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @Post()
  @ApiIdempotencyKey()
  @UseInterceptors(IdempotencyInterceptor)
  @UseGuards(PoliciesGuard)
  @CheckPolicies(createTaskPolicy)
  create(@Body() createTaskDto: CreateTaskDto, @Request() req) {
    return this.commandBus.execute(
      new CreateTaskCommand(createTaskDto, req.user.userId),
    );
  }

  @ApiOperation({
    summary: 'Assign task to workspace members',
  })
  @ApiResponse({
    status: 200,
    description: 'Task assigned successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to assign this task.',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found.',
  })
  @Patch(':id/assignees')
  @UseGuards(PoliciesGuard)
  @LoadTask()
  @CheckPolicies(assignTaskPolicy)
  assignTask(
    @Param('id') taskId: string,
    @Query('workspaceId') workspaceId: string,
    @Body() assignTaskDto: AssignTaskDto,
    @Request() req,
  ) {
    return this.commandBus.execute(
      new AssignTaskCommand(
        taskId,
        req.user.userId,
        workspaceId,
        assignTaskDto,
      ),
    );
  }

  @ApiOperation({
    summary: 'Get all tasks',
  })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @Get()
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readTaskPolicy)
  async findAll(
    @Request() req,
    @Query('workspaceId') workspaceId: string,
    @Query() query: GetTasksQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.queryBus.execute(
      new GetTasksQuery(req.user.userId, req.user.role, workspaceId, query),
    );
    if (result?.meta) {
      res.setHeader('X-Total', String(result.meta.total));
      res.setHeader('X-Page', String(result.meta.page));
      res.setHeader('X-Limit', String(result.meta.limit));
      res.setHeader('X-Total-Pages', String(result.meta.totalPages));
    }

    return result;
  }

  @ApiOperation({
    summary: 'Get task statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Task statistics returned successfully.',
  })
  @Get('stats')
  getStats(@Request() req) {
    return this.queryBus.execute(
      new GetTaskStatsQuery(req.user.userId, req.user.role),
    );
  }

  @ApiOperation({
    summary: 'Get task by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Task retrieved successfully.',
    type: TaskResponseDto,
  })
  @ApiResponse({
    status: 304,
    description:
      'Not Modified. The task has not changed since the supplied ETag.',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found.',
  })
  @Get(':id')
  @ApiIfNoneMatch()
  @UseGuards(PoliciesGuard)
  @LoadTask()
  @CheckPolicies(readTaskPolicy)
  async findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Request() req,
    @Query('workspaceId') workspaceId: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ) {
    const task = await this.queryBus.execute(
      new GetTaskByIdQuery(id, req.user.userId, req.user.role, workspaceId),
    );
    const etag = `"${task.__v}"`;
    res.setHeader('ETag', etag);

    const clientVersions = parseIfNoneMatch(ifNoneMatch);

    if (clientVersions.includes(task.__v) || clientVersions.includes(-1)) {
      res.status(304);
      return;
    }

    return task;
  }

  @ApiOperation({
    summary: 'Update a task',
  })
  @ApiResponse({
    status: 200,
    description: 'Task updated successfully.',
    type: TaskResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict. The task was modified by another request.',
  })
  @ApiResponse({
    status: 412,
    description: 'Precondition failed. The task version does not match.',
  })
  @ApiResponse({
    status: 428,
    description: 'Precondition Required. If-Match header is required.',
  })
  @Patch(':id')
  @ApiIfMatch()
  @UseGuards(PoliciesGuard)
  @LoadTask()
  @CheckPolicies(updateTaskPolicy)
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req,
    @Headers('if-match') ifMatch: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const expectedVersion = parseIfMatch(ifMatch);

    const task = await this.commandBus.execute(
      new UpdateTaskCommand(
        id,
        updateTaskDto,
        req.user.userId,
        req.user.role,
        workspaceId,
        expectedVersion,
      ),
    );
    res.setHeader('ETag', `"${task.__v}"`);

    return task;
  }

  @ApiOperation({
    summary: 'Add a comment to a task',
  })
  @ApiResponse({
    status: 201,
    description: 'Comment added successfully.',
  })
  @Post(':id/comments')
  @ApiIdempotencyKey()
  @UseInterceptors(IdempotencyInterceptor)
  @UseGuards(PoliciesGuard)
  @CheckPolicies(createCommentPolicy)
  addComment(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Request() req,
  ) {
    return this.commandBus.execute(
      new CreateCommentCommand(
        id,
        createCommentDto,
        req.user.userId,
        req.user.role,
        workspaceId,
      ),
    );
  }

  @ApiOperation({
    summary: 'Get all comments for a task',
  })
  @ApiResponse({
    status: 200,
    description: 'Comments retrieved successfully.',
  })
  @Get(':id/comments')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readCommentPolicy)
  getComments(
    @Param('id', ParseObjectIdPipe) id: string,
    @Request() req,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.queryBus.execute(
      new GetCommentsQuery(id, req.user.userId, req.user.role, workspaceId),
    );
  }

  @ApiOperation({
    summary: 'Upload a task attachment',
    description: 'Uploads an image or PDF attachment for the specified task.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image (JPEG, PNG, GIF, WebP) or PDF file (max 5 MB).',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Attachment uploaded successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or file size exceeds the maximum limit.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found.',
  })
  @Post(':id/attachments')
  @ApiIdempotencyKey()
  @UseGuards(PoliciesGuard)
  @CheckPolicies(manageAttachmentPolicy)
  @UseInterceptors(
    IdempotencyInterceptor,
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueName =
            Date.now() +
            '-' +
            Math.round(Math.random() * 1e9) +
            extname(file.originalname);
          callback(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Only image and PDF files are allowed.'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  uploadAttachment(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.commandBus.execute(
      new UploadAttachmentCommand(
        id,
        file,
        req.user.userId,
        req.user.role,
        workspaceId,
      ),
    );
  }

  @ApiOperation({
    summary: 'Get task attachments',
  })
  @ApiResponse({
    status: 200,
    description: 'Attachments retrieved successfully.',
  })
  @Get(':id/attachments')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readAttachmentPolicy)
  getAttachments(
    @Param('id', ParseObjectIdPipe) id: string,
    @Request() req,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.queryBus.execute(
      new GetAttachmentsQuery(id, req.user.userId, req.user.role, workspaceId),
    );
  }

  @ApiOperation({
    summary: 'Get task activity log',
  })
  @ApiResponse({
    status: 200,
    description: 'Task activity retrieved successfully.',
  })
  @Get(':id/activity')
  @UseGuards(PoliciesGuard)
  @LoadTask()
  @CheckPolicies(readTaskPolicy)
  async getTaskActivity(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query('workspaceId') workspaceId: string,
    @Request() req,
  ) {
    return this.queryBus.execute(
      new GetTaskActivitiesQuery(id, req.user.userId, req.user.role),
    );
  }

  @ApiOperation({
    summary: 'Delete a task attachment',
  })
  @ApiResponse({
    status: 200,
    description: 'Attachment deleted successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Attachment not found.',
  })
  @Delete(':id/attachments/:attachmentId')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(manageAttachmentPolicy)
  deleteAttachment(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query('workspaceId') workspaceId: string,
    @Param('attachmentId', ParseObjectIdPipe) attachmentId: string,
    @Request() req,
  ) {
    return this.commandBus.execute(
      new DeleteAttachmentCommand(
        id,
        attachmentId,
        req.user.userId,
        req.user.role,
        workspaceId,
      ),
    );
  }

  @ApiOperation({
    summary: 'Soft delete a task',
  })
  @ApiResponse({
    status: 200,
    description: 'Task deleted successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found.',
  })
  @Delete(':id')
  @UseGuards(PoliciesGuard)
  @LoadTask()
  @CheckPolicies(deleteTaskPolicy)
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Request() req,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.commandBus.execute(
      new DeleteTaskCommand(id, req.user.userId, req.user.role, workspaceId),
    );
  }
}
