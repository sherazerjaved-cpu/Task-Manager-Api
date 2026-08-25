import { validate } from 'class-validator';
import { AddMemberDto } from './add-member.dto';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

describe('AddMemberDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new AddMemberDto();

    dto.userId = '68a123456789abcdef123456';
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail when userId is missing', async () => {
    const dto = new AddMemberDto();

    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('userId');
  });

  it('should fail when userId is empty', async () => {
    const dto = new AddMemberDto();

    dto.userId = '';
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('userId');
  });

  it('should fail when userId is not a string', async () => {
    const dto = new AddMemberDto();

    dto.userId = 12345 as any;
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('userId');
  });

  it('should fail when role is missing', async () => {
    const dto = new AddMemberDto();

    dto.userId = '68a123456789abcdef123456';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('role');
  });

  it('should fail when role is invalid', async () => {
    const dto = new AddMemberDto();

    dto.userId = '68a123456789abcdef123456';
    dto.role = 'INVALID_ROLE' as WorkspaceRole;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('role');
  });

  it('should accept MEMBER role', async () => {
    const dto = new AddMemberDto();

    dto.userId = '68a123456789abcdef123456';
    dto.role = WorkspaceRole.MEMBER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept ADMIN role', async () => {
    const dto = new AddMemberDto();

    dto.userId = '68a123456789abcdef123456';
    dto.role = WorkspaceRole.ADMIN;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept VIEWER role', async () => {
    const dto = new AddMemberDto();

    dto.userId = '68a123456789abcdef123456';
    dto.role = WorkspaceRole.VIEWER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
