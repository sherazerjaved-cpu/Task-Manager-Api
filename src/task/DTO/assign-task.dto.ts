import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId, ArrayMinSize } from 'class-validator';

export class AssignTaskDto {
  @ApiProperty({
    example: ['68a123456789abcdef123456', '68a123456789abcdef123457'],
    description: 'User IDs to assign to the task',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  userIds!: string[];
}
