import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '../Enums/task-priority.enum';
import { TaskStatus } from '../Enums/task-status.enum';

class AttachmentResponseDto {
  @ApiProperty({
    example: '68a123456789abcdef123457',
  })
  _id!: string;

  @ApiProperty({
    example: 'assignment.pdf',
  })
  filename!: string;

  @ApiProperty({
    example: 'application/pdf',
  })
  mime!: string;

  @ApiProperty({
    example: 245760,
  })
  size!: number;

  @ApiProperty({
    example: '/uploads/assignment.pdf',
  })
  url!: string;
}

class CommentResponseDto {
  @ApiProperty({
    example: '68a123456789abcdef123458',
  })
  author!: string;

  @ApiProperty({
    example: 'This task is ready for review.',
  })
  body!: string;

  @ApiProperty({
    example: '2026-08-14T18:30:00.000Z',
  })
  createdAt!: Date;
}

export class TaskResponseDto {
  @ApiProperty({
    example: '68a123456789abcdef123456',
  })
  _id!: string;

  @ApiProperty({
    example: 'Complete Backend Assignment',
  })
  title!: string;

  @ApiPropertyOptional({
    example: 'Finish the remaining Section 8 requirements.',
  })
  description?: string;

  @ApiProperty({
    enum: TaskStatus,
    example: TaskStatus.Pending,
  })
  status!: TaskStatus;

  @ApiProperty({
    enum: TaskPriority,
    example: TaskPriority.High,
  })
  priority!: TaskPriority;

  @ApiPropertyOptional({
    example: '2026-08-20T18:00:00.000Z',
  })
  dueDate?: Date;

  @ApiPropertyOptional({
    example: '68a123456789abcdef123459',
  })
  category?: string;

  @ApiProperty({
    example: ['nestjs', 'backend', 'assignment'],
    type: [String],
  })
  tags!: string[];

  @ApiProperty({
    example: false,
  })
  isDeleted!: boolean;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
  })
  deletedAt?: Date | null;

  @ApiProperty({
    example: false,
  })
  reminderSent!: boolean;

  @ApiProperty({
    type: [CommentResponseDto],
  })
  comments!: CommentResponseDto[];

  @ApiProperty({
    type: [AttachmentResponseDto],
  })
  attachments!: AttachmentResponseDto[];

  @ApiProperty({
    example: '68a123456789abcdef123460',
  })
  owner!: string;

  @ApiProperty({
    example: '68a123456789abcdef123461',
  })
  workspace!: string;

  @ApiProperty({
    example: ['68a123456789abcdef123462'],
    type: [String],
  })
  assignees!: string[];

  @ApiProperty({
    example: '2026-08-14T18:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-08-14T18:30:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    example: 3,
    description: 'Mongoose document version used for optimistic concurrency.',
  })
  __v!: number;
}
