import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsMongoId,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetTasksQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of tasks per page',
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'pending',
    description: 'Filter tasks by status',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    example: 'assignment',
    description: 'Search tasks by title, description, or tags',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'priority:desc,dueDate:asc',
    description: 'Sort by multiple fields',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    example: 'dueDate',
    description: 'Sort by a single field (legacy support)',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    example: 'asc',
    description: 'Sort order',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Return tasks due on or after this date',
  })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Return tasks due on or before this date',
  })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional({
    example: '687abc1234567890abcdef12',
    description: 'Cursor for keyset pagination',
  })
  @IsOptional()
  @IsMongoId()
  cursor?: string;

  @ApiPropertyOptional({
    example: 'nestjs',
    description: 'Filter tasks by tag',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    enum: ['offset', 'cursor'],
    example: 'offset',
    description: 'Pagination strategy',
  })
  @IsOptional()
  @IsIn(['offset', 'cursor'])
  pagination?: 'offset' | 'cursor' = 'offset';

  @ApiPropertyOptional({
    example: 'me',
    description:
      'Filter tasks by assignee. Use "me" for the authenticated user or provide a user ID.',
  })
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiPropertyOptional({
    example: '6a769ce2c663a9470b6d7558',
    description: 'Workspace ID',
  })
  @IsOptional()
  @IsMongoId()
  workspaceId?: string;
}
