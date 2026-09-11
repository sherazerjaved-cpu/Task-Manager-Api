import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { TaskPriority } from '../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../task/Enums/task-status.enum';

export class UpdateWorkspaceSettingsDto {
  @ApiPropertyOptional({
    example: 'Asia/Karachi',
    description: 'IANA timezone used by the workspace.',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    enum: TaskPriority,
    example: TaskPriority.Medium,
    description: 'Default priority assigned to newly created tasks.',
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  defaultTaskPriority?: TaskPriority;

  @ApiPropertyOptional({
    enum: TaskStatus,
    example: TaskStatus.Pending,
    description: 'Default status assigned to newly created tasks.',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  defaultTaskStatus?: TaskStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable or disable workspace email notifications.',
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Enable or disable notifications when tasks are assigned to members.',
  })
  @IsOptional()
  @IsBoolean()
  taskAssignmentNotifications?: boolean;
}
