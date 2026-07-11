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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TaskService } from './task.service';
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
import { ActivityService } from 'src/activity/activity.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'tasks', version: '1' })
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly activityService: ActivityService,
  ) {}

@ApiOperation({
  summary: 'Create a new task',
})
@ApiResponse({
  status: 201,
  description: 'Task created successfully.',
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
  create(@Body() createTaskDto: CreateTaskDto, @Request() req) {
    return this.taskService.create(createTaskDto, req.user.userId);
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
  findAll(@Request() req, @Query() query: GetTasksQueryDto) {
    return this.taskService.findAll(req.user.userId, req.user.role, query);
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
    return this.taskService.getStats(req.user.userId, req.user.role);
  }

@ApiOperation({
  summary: 'Get task by ID',
})
@ApiResponse({
  status: 200,
  description: 'Task retrieved successfully.',
})
@ApiResponse({
  status: 404,
  description: 'Task not found.',
})
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string, @Request() req) {
    return this.taskService.findOne(id, req.user.userId, req.user.role);
  }

@ApiOperation({
  summary: 'Update a task',
})
@ApiResponse({
  status: 200,
  description: 'Task updated successfully.',
})
@ApiResponse({
  status: 404,
  description: 'Task not found.',
})
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req,
  ) {
    return this.taskService.update(
      id,
      updateTaskDto,
      req.user.userId,
      req.user.role,
    );
  }

@ApiOperation({
  summary: 'Add a comment to a task',
})
@ApiResponse({
  status: 201,
  description: 'Comment added successfully.',
})
  @Post(':id/comments')
  addComment(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Request() req,
  ) {
    return this.taskService.addComment(
      id,
      createCommentDto,
      req.user.userId,
      req.user.role,
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
  getComments(@Param('id', ParseObjectIdPipe) id: string, @Request() req) {
    return this.taskService.getComments(id, req.user.userId, req.user.role);
  }


@ApiOperation({
  summary: 'Upload a task attachment',
   description:'Uploads an image or PDF attachment for the specified task.',
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
  @UseInterceptors(
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
  ) {
    return this.taskService.uploadAttachment(
      id,
      file,
      req.user.userId,
      req.user.role,
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
  getAttachments(@Param('id', ParseObjectIdPipe) id: string, @Request() req) {
    return this.taskService.getAttachments(id, req.user.userId, req.user.role);
  }
  @ApiOperation({
  summary: 'Get task activity log',
})
@ApiResponse({
  status: 200,
  description: 'Task activity retrieved successfully.',
})
  @Get(':id/activity')
  async getTaskActivity(
    @Param('id', ParseObjectIdPipe) id: string,
    @Request() req,
  ) {
    await this.taskService.authorizeTaskAccess(
      id,
      req.user.userId,
      req.user.role,
    );
    return this.activityService.findByTask(id);
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
  deleteAttachment(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('attachmentId', ParseObjectIdPipe) attachmentId: string,
    @Request() req,
  ) {
    return this.taskService.deleteAttachment(
      id,
      attachmentId,
      req.user.userId,
      req.user.role,
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
  remove(@Param('id', ParseObjectIdPipe) id: string, @Request() req) {
    return this.taskService.remove(id, req.user.userId, req.user.role);
  }
}
