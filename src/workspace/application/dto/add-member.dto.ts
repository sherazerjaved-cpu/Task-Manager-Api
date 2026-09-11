import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

export class AddMemberDto {
  @ApiProperty({
    example: '68a123456789abcdef123456',
    description: 'ID of the user to add to the workspace.',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    enum: WorkspaceRole,
    example: WorkspaceRole.MEMBER,
    description: 'Role assigned to the user in the workspace.',
  })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
