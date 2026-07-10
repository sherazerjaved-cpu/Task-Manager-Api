import { Inject, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Task, TaskDocument } from './Schema/task.schema';
import { Model, Types } from 'mongoose';
import { CreateTaskDto } from './DTO/create-task.dto';
import { UpdateTaskDto } from './DTO/update-task.dto';
import { Category, CategoryDocument } from 'src/categories/Schema/categories.schema';
import { CreateCommentDto } from './DTO/create-comment.dto';
import * as fs from "fs";
import * as path from "path";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TaskGateway } from 'src/websocket/task/task.gateway';
import { ActivityService } from 'src/activity/activity.service';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';


@Injectable()
export class TaskService {
    private taskCacheKeys = new Set<string>();

    constructor (@InjectModel(Task.name) private taskModel:Model<TaskDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @Inject(CACHE_MANAGER) private cacheManager:Cache,
    private readonly taskGateway: TaskGateway, private readonly activityService: ActivityService
    ){}

        private async clearTaskCache() {
        for (const key of this.taskCacheKeys) {
            await this.cacheManager.del(key);
        }
        this.taskCacheKeys.clear();
        }


        private async getAuthorizedTask(id: string, userId: string, role: string) {
            const task = await this.taskModel.findOne({_id: id, isDeleted: false})
            .populate("owner").populate("category");
            if (!task) {
                throw new NotFoundException("Task Not Found")
            }
            if ( role !== "admin" && task.owner && task.owner._id.toString() !== userId) {
                throw new ForbiddenException(
                    "You are not allowed to access this task"
                );
            }
            return task;
        }


        async authorizeTaskAccess(id: string,userId: string, role: string) {
            return this.getAuthorizedTask(id, userId, role);
        }

        private buildChanges(task: Task, updateTaskDto: UpdateTaskDto){
            return {}
        };


    async create(createTaskDto: CreateTaskDto, userId: string): Promise <Task>{
        if(createTaskDto.category){
            const category = await this.categoryModel.findOne({_id:createTaskDto.category, owner:userId})
              if (!category) {
                throw new NotFoundException('Category not found');
        }}
        const task = await this.taskModel.create({...createTaskDto, owner: new Types.ObjectId(userId)})
        await this.activityService.create({task: task._id, user: new Types.ObjectId(userId),
            action: ActivityAction.CREATED, description: 'Task created'});
        await this.clearTaskCache();
        this.taskGateway.emitTaskCreated(userId, task);
        return task;
    }

    async findAll(userId:string, role:string, query:any){ 
        const { page = 1, limit = 10, status, search,
        sort, sortBy = "createdAt", order = "desc",
        dueFrom, dueTo, tags} = query;

        const cacheKey = `tasks:${JSON.stringify({userId, role, page, limit,
        status, search, sort, sortBy, order, dueFrom, dueTo, tags})}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            console.log("Returning tasks from cache");
            return cached
        }

        const filter:any = {isDeleted:false};

        if( role !== "admin"){
             filter.owner = new Types.ObjectId(userId);;
        }
        if(status){
            filter.status= status
        };
            if(search){
                filter.title= {$regex: search, $options: "i"}
            };
        if(dueFrom || dueTo){
             filter.dueDate = {};
        if (dueFrom) {
            filter.dueDate.$gte = new Date(dueFrom)
        }
        if (dueTo){
            filter.dueDate.$lte = new Date(dueTo)
        }
        }
        if (tags){
            filter.tags = {
                $all: tags.split (",")
            }
        }
            const sortObj: any = {};
            if(sort){
                const sortFields = sort.split(",");
                sortFields.forEach((field:string) => {
                    const [key, direction] = field.split(":");
                    sortObj [key] = direction === "asc" ? 1: -1;
                });
            }else {
                const sortOrder = order === "asc" ? 1: -1;
                sortObj[sortBy] = sortOrder
            }
            const skip = (page - 1) * limit;
            const tasks = await this.taskModel.find(filter).populate("owner")
            .populate("category").sort(sortObj).skip(skip).limit(Number(limit));           
            const total = await this.taskModel.countDocuments(filter);
            const result = {data:tasks, meta: {total, page:Number(page), limit:Number(limit), 
                totalPages: Math.ceil(total/Number(limit))}}

                await this.cacheManager.set(cacheKey, result, 60 * 1000);
                 this.taskCacheKeys.add(cacheKey);
                 return result;
    }

    async findOne(id: string, userId: string, role: string) {
        const cacheKey = `task:${id}:${userId}:${role}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            console.log("Returning task from cache");
            return cached;
        }
        const task = await this.getAuthorizedTask(id, userId, role);
        await this.cacheManager.set(cacheKey, task, 60 * 1000);
        this.taskCacheKeys.add(cacheKey);
        return task;
    }

    async update(id: string, updateTaskDto: UpdateTaskDto, userId: string, role: string): Promise<Task> {
        if (updateTaskDto.category) {
            const categoryFilter: any = {_id: updateTaskDto.category};
            if (role !== "admin") {
                categoryFilter.owner = userId
            }
        const category = await this.categoryModel.findOne(categoryFilter);
        if (!category) {
            throw new NotFoundException("Category not found");
        }
        }
        const task = await this.getAuthorizedTask(id, userId, role);
        const changes = this.buildChanges(task, updateTaskDto);
        Object.assign(task, updateTaskDto);
        await task.save();

        if (Object.keys(changes).length > 0) { await this.activityService.create({
            task: task._id, user: new Types.ObjectId(userId),
            action: ActivityAction.UPDATED, description: 'Task updated', changes, });
        }      
            await this.clearTaskCache();
            this.taskGateway.emitTaskUpdated(task.owner.toString(),task)
            return task;
    }

    async addComment(id: string, createCommentDto: CreateCommentDto, userId: string, role: string,) {
        const task = await this.getAuthorizedTask(id, userId, role);
        task.comments.push({author: userId as any,
            body: createCommentDto.body,
            createdAt: new Date(),
        });
        await task.save();
        await this.activityService.create({task: task._id, user: new Types.ObjectId(userId),
            action: ActivityAction.COMMENT_ADDED, description: 'Comment added',
        });
        await this.clearTaskCache();
        return task;
    }

    async getComments(id: string, userId: string, role: string) {
        const task = await this.getAuthorizedTask(id, userId, role);
        await task.populate("comments.author");
        return task.comments;
    }

    async uploadAttachment(id: string, file: Express.Multer.File, userId: string, role: string) {
        const task = await this.getAuthorizedTask(id, userId, role);
        task.attachments.push({
            filename: file.filename, mime: file.mimetype,
            size: file.size, url: `/uploads/${file.filename}`,
        });
        await task.save();
          await this.activityService.create({task: task._id, user: new Types.ObjectId(userId),
            action: ActivityAction.ATTACHMENT_ADDED, description: 'Attachment added',
        });
        await this.clearTaskCache();
        return task.attachments;
    }

    async getAttachments(id: string, userId: string, role: string) {
        const task = await this.getAuthorizedTask(id, userId, role);
        return task.attachments;
    }

    async deleteAttachment(id: string, attachmentId: string, userId: string, role: string) {
        const task = await this.getAuthorizedTask(id, userId, role);
        const attachment = task.attachments.find((attachment) =>
            attachment._id?.toString() === attachmentId.toString(),
    );
        if (!attachment) {
            throw new NotFoundException("Attachment Not Found");
        }
        const filePath = path.join(process.cwd(), attachment.url.replace(/^\//, ""),);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        task.attachments = task.attachments.filter( (attachment) =>
        attachment._id?.toString() !== attachmentId.toString(),
        );
        await task.save();
        await this.activityService.create({task: task._id, user: new Types.ObjectId(userId),
            action: ActivityAction.ATTACHMENT_DELETED, description: 'Attachment deleted',
        });
        await this.clearTaskCache();
        return {
        message: "Attachment deleted successfully."};
    }

    async getStats(userId: string, role: string) {
        const cacheKey = `stats:${userId}:${role}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
        console.log("Returning stats from cache");
        return cached;
    }

        const matchStage = role === "admin"? { isDeleted: false }: 
        {
        owner: new Types.ObjectId(userId), isDeleted: false};
        const stats = await this.taskModel.aggregate([
            {
                $match: matchStage
            },
            {
                $facet: {status: [{$group: {_id: "$status", count: { $sum: 1 }}}],
                priority: [{$group: {_id: "$priority", count: { $sum: 1 }}}],
                overdue: [{$match: {dueDate: { $lt: new Date() }, status: { $ne: "done" }},},
            {
            $count: "count",
            },],},},]);
            const result = stats[0];
            const response = { status: Object.fromEntries(result.status.map((item) => [
                item._id, item.count])),
                priority: Object.fromEntries(result.priority.map((item) => [
                item._id, item.count])),
                overdue: result.overdue[0]?.count || 0
            };

            await this.cacheManager.set(cacheKey, response, 60 * 1000);
            this.taskCacheKeys.add(cacheKey);
            return response;
        }


    async remove(id: string, userId: string, role: string) {
     const task = await this.getAuthorizedTask(id, userId, role);
     task.isDeleted = true;
     task.deletedAt = new Date();
     await task.save();
     
     await this.activityService.create({task: task._id, user: new Types.ObjectId(userId),
        action: ActivityAction.DELETED, description: 'Task deleted',
    });

        await this.clearTaskCache();
        this.taskGateway.emitTaskDeleted(task.owner.toString(), task._id.toString());
        return {message: "Task Deleted Successfully!"};
    }

}
