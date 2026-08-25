import {
  IsMongoId,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
} from 'class-validator';
import { TaskPriority } from '../Enums/task-priority.enum';
import { TaskStatus } from '../Enums/task-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaskDto {
  @ApiPropertyOptional({
    example: 'Complete Backend Assignment',
    description: 'Updated title of the task',
    minLength: 3,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional({
    example: 'Finish the remaining Phase 2 requirements.',
    description: 'Updated task description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: TaskStatus,
    example: TaskStatus.Done,
    description: 'Updated status of the task',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    enum: TaskPriority,
    example: TaskPriority.High,
    description: 'Updated priority of the task',
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    example: '2026-08-20T18:00:00.000Z',
    description: 'Updated task due date',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: '686f4c7ef8f64e95d25f6b7d',
    description: 'Updated category ID',
  })
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiPropertyOptional({
    example: ['nestjs', 'backend', 'assignment'],
    description: 'Updated tags associated with the task',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
