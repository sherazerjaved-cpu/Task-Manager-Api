import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUrl,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({
    example: 'https://example.com/webhooks/task-events',
    description: 'HTTPS endpoint that will receive webhook events.',
  })
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @IsNotEmpty()
  url!: string;

  @ApiProperty({
    example: ['task.created', 'task.updated', 'task.deleted'],
    description: 'Events that should trigger this webhook.',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events!: string[];
}
