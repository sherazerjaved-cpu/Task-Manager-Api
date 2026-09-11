import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreateExportDto {
  @ApiProperty({
    enum: ['json', 'csv', 'xlsx'],
    example: 'csv',
    description: 'Format in which the workspace export should be generated.',
  })
  @IsString()
  @IsIn(['json', 'csv', 'xlsx'])
  format!: 'json' | 'csv' | 'xlsx';
}
