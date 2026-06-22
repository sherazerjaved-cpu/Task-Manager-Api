import { IsString, IsOptional, IsEnum, IsDateString, MinLength } from "class-validator";
import { TaskPriority } from "../Enums/task-priority.enum";
import { TaskStatus } from "../Enums/task-status.enum";

export class CreateTaskDto{
    @IsString()
    @MinLength(3)
    title!: string;

    @IsOptional()
    description?: string;

    @IsOptional()
    @IsEnum(TaskStatus)
    status?: TaskStatus;

    @IsOptional()
    @IsEnum(TaskPriority)
    priority?: TaskPriority;

    @IsOptional()
    @IsDateString()
    duedate?: string;
}