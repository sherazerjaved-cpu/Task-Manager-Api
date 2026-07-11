import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCategryDto {
  @ApiProperty({
    example: 'Work',
    description: 'Name of the category',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    example: '#3498db',
    description: 'Category color in HEX format',
  })
  @IsOptional()
  @IsString()
  color?: string;
}
