import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({
    example: 'This task is almost complete.',
    description: 'Comment text',
  })
  @IsString()
  @IsNotEmpty()
  body!: string;
}
