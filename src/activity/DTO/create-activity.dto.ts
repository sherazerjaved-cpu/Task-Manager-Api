import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ActivityAction } from '../enums/activity-action.enum';

export class CreateActivityDto {
  @ApiProperty({
    example: '68a123456789abcdef123456',
    description: 'ID of the task associated with the activity.',
  })
  task!: Types.ObjectId;

  @ApiProperty({
    example: '68a123456789abcdef123457',
    description: 'ID of the user who performed the activity.',
  })
  user!: Types.ObjectId;

  @ApiProperty({
    enum: ActivityAction,
    example: ActivityAction.UPDATED,
    description: 'Action performed on the task.',
  })
  action!: ActivityAction;

  @ApiPropertyOptional({
    example: 'Task priority changed from medium to high.',
    description: 'Human-readable description of the activity.',
  })
  description?: string;

  @ApiPropertyOptional({
    example: {
      priority: {
        old: 'medium',
        new: 'high',
      },
    },
    description: 'Details of the fields changed by the action.',
    type: Object,
  })
  changes?: Record<string, any>;
}
