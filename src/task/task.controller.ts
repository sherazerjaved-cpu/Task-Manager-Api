import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './DTO/create-task.dto';
import { UpdateTaskDto } from './DTO/update-task.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { ApiBearerAuth } from '@nestjs/swagger';


@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskController {
    constructor (private readonly taskService: TaskService){}

    @Post()
    create(@Body() createTaskDto: CreateTaskDto, @Request() req){
        return this.taskService.create(createTaskDto, req.user.userId)
    }
    
    @Get()
    findAll(@Request() req, @Query() query:any){
        return this.taskService.findAll(req.user.userId, query)
    }

    @Get(":id")
    findOne(@Param("id", ParseObjectIdPipe) id:string, @Request() req){
        return this.taskService.findOne(id, req.user.userId)
    }

    @Patch(":id")
    update(@Param("id", ParseObjectIdPipe) id:string, @Body() updateTaskDto:UpdateTaskDto, @Request() req){
        return this.taskService.update(id, updateTaskDto, req.user.userId)
    }

    @Delete(":id")
    remove(@Param("id", ParseObjectIdPipe) id:string, @Request() req){
        return this.taskService.remove(id, req.user.userId)
    }
}
