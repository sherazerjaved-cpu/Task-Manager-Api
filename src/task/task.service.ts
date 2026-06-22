import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Task, TaskDocument } from './Schema/task.schema';
import { Model } from 'mongoose';
import { CreateTaskDto } from './DTO/create-task.dto';
import { UpdateTaskDto } from './DTO/update-task.dto';
import { promises } from 'dns';

@Injectable()
export class TaskService {
    constructor (@InjectModel(Task.name) private taskModel:Model<TaskDocument>){}

    async create(createTaskDto: CreateTaskDto, userId: string): Promise <Task>{
        return this.taskModel.create({...createTaskDto, owner: userId})
    }

    async findAll(userId:string, query:any){
        const {page = 1, limit=10, status, search, sortBy = "createdAt", order="desc"} = query;
        const filter:any = {owner:userId};
        if(status){
            filter.status= status
        };
            if(search){
                filter.title= {$regex: search, $options: "i"}
            };
            const sortOrder = order === "asc" ? 1:-1;
            const sort:any = {[sortBy]:sortOrder};
            const skip = (page - 1) * limit;
            const tasks = await this.taskModel.find(filter).populate("owner").sort(sort).skip(skip).limit(Number(limit));
            const total = await this.taskModel.countDocuments(filter);
            return {data:tasks, total, page:Number(page), limit:Number(limit), totalPages: Math.ceil(total/limit)}
    }

    async findOne(id:string, userId:string){
        const task = await this.taskModel.findOne({_id:id, owner:userId});
        if(!task){
            throw new NotFoundException("Task Not Found")
        }
        return task;
    }

    async update(id:string, updateTaskDto: UpdateTaskDto, userId:string): Promise<Task>{
        const task = await this.taskModel.findOneAndUpdate({_id:id, owner:userId}, updateTaskDto, {new:true});
        if(!task){
            throw new NotFoundException ("Task Not Found")
        }
        return task;
    }

    async remove(id:string, userId:string){
        const task = await this.taskModel.findOneAndDelete({_id:id, owner:userId});
        if(!task){
            throw new NotFoundException ("Task Not Found")
        }
        return {message: "Task Deleted Successfully!"} 
    }

}
