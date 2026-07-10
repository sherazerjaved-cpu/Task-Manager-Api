import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './DTO/create-task.dto';
import { UpdateTaskDto } from './DTO/update-task.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateCommentDto } from './DTO/create-comment.dto';
import { GetTasksQueryDto } from './DTO/get-task-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ActivityService } from 'src/activity/activity.service';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({path: 'tasks', version: '1'})
export class TaskController {
    constructor (private readonly taskService: TaskService,
        private readonly activityService: ActivityService){}

    @Post()
    create(@Body() createTaskDto: CreateTaskDto, @Request() req){
        return this.taskService.create(createTaskDto, req.user.userId)
    }
    
    @Get()
    findAll(@Request() req, @Query() query:GetTasksQueryDto){
        return this.taskService.findAll(req.user.userId, req.user.role, query)
    }

    @Get("stats")
    getStats(@Request() req){
        return this.taskService.getStats(req.user.userId, req.user.role)
    }

    @Get(":id")
    findOne(@Param("id", ParseObjectIdPipe) id:string, @Request() req){
        return this.taskService.findOne(id, req.user.userId, req.user.role)
    }

    @Patch(":id")
    update(@Param("id", ParseObjectIdPipe) id:string, @Body() updateTaskDto:UpdateTaskDto, @Request() req){
        return this.taskService.update(id, updateTaskDto, req.user.userId, req.user.role)
    }

    @Post(':id/comments')
    addComment(@Param('id', ParseObjectIdPipe) id: string, @Body() createCommentDto: CreateCommentDto, @Request() req){
        return this.taskService.addComment(id, createCommentDto, req.user.userId, req.user.role)
    }

    @Get(':id/comments')
    getComments(@Param('id', ParseObjectIdPipe) id: string, @Request() req) {
        return this.taskService.getComments(id, req.user.userId, req.user.role)}

    @Post(':id/attachments')
    @UseInterceptors(
        FileInterceptor('file', {storage: diskStorage({
            destination: './uploads',
            filename: (req, file, callback) => {
                const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) +
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
          new BadRequestException(
            'Only image and PDF files are allowed.',
          ),
          false,
        );
      }
      callback(null, true);
    },})) 
    uploadAttachment(@Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File, @Request() req) {
        return this.taskService.uploadAttachment(id, file, req.user.userId, req.user.role)
    }

    @Get(":id/attachments")
    getAttachments(@Param("id", ParseObjectIdPipe) id: string, @Request() req) {
        return this.taskService.getAttachments(id, req.user.userId, req.user.role)
    }

    @Get(':id/activity')
    async getTaskActivity(@Param('id', ParseObjectIdPipe) id: string, @Request() req) {
        await this.taskService.authorizeTaskAccess(id, req.user.userId, req.user.role);
        return this.activityService.findByTask(id)
    }

    @Delete(":id/attachments/:attachmentId")
    deleteAttachment(@Param("id", ParseObjectIdPipe) id: string,
    @Param("attachmentId", ParseObjectIdPipe) attachmentId: string, @Request() req) {
        return this.taskService.deleteAttachment(id, attachmentId, req.user.userId, req.user.role)
    }

    @Delete(":id")
    remove(@Param("id", ParseObjectIdPipe) id:string, @Request() req){
        return this.taskService.remove(id, req.user.userId, req.user.role)
    }
}
