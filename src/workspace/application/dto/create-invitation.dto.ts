import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

export class CreateInvitationDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address of the user being invited.',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    enum: WorkspaceRole,
    example: WorkspaceRole.MEMBER,
    description: 'Workspace role assigned to the invited user.',
  })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
