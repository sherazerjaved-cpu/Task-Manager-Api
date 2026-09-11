import { validate } from 'class-validator';
import { CreateInvitationDto } from './create-invitation.dto';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

describe('CreateInvitationDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new CreateInvitationDto();

    dto.email = 'user@example.com';
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail when email is missing', async () => {
    const dto = new CreateInvitationDto();

    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('should fail when email is empty', async () => {
    const dto = new CreateInvitationDto();

    dto.email = '';
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('should fail when email is invalid', async () => {
    const dto = new CreateInvitationDto();

    dto.email = 'invalid-email';
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('should fail when email is not a string', async () => {
    const dto = new CreateInvitationDto();

    dto.email = 12345 as any;
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('should fail when role is missing', async () => {
    const dto = new CreateInvitationDto();

    dto.email = 'user@example.com';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('role');
  });

  it('should fail when role is invalid', async () => {
    const dto = new CreateInvitationDto();

    dto.email = 'user@example.com';
    dto.role = 'INVALID_ROLE' as WorkspaceRole;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('role');
  });

  it('should accept MEMBER role', async () => {
    const dto = new CreateInvitationDto();

    dto.email = 'user@example.com';
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
