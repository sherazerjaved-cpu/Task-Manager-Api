import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFeatureFlagsDto {
  @ApiPropertyOptional({
    description: 'Enable or disable workspace webhooks.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  webhooks?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable workspace data exports.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  exports?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable workspace reminders.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  reminders?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable email notifications.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable advanced task filtering.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  advancedTaskFiltering?: boolean;
}
