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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    example: 'Complete Backend Assignment',
    description: 'Title of the task',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({
    example: 'Finish the remaining Phase 2 requirements.',
    description: 'Detailed description of the task',
  })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: TaskStatus,
    example: TaskStatus.Pending,
    description: 'Current status of the task',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    enum: TaskPriority,
    example: TaskPriority.High,
    description: 'Priority level of the task',
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    example: '2026-07-20T18:00:00.000Z',
    description: 'Task due date',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: '686f4c7ef8f64e95d25f6b7d',
    description: 'Category ID',
  })
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiPropertyOptional({
    example: ['nestjs', 'backend', 'assignment'],
    description: 'Tags associated with the task',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
