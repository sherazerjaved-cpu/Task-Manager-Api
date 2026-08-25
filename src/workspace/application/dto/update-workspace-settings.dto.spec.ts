import { validate } from 'class-validator';
import { UpdateWorkspaceSettingsDto } from './update-workspace-settings.dto';
import { TaskPriority } from '../../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../../task/Enums/task-status.enum';

describe('UpdateWorkspaceSettingsDto', () => {
  it('should pass validation when no fields are provided', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should pass validation with all valid fields', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    dto.timezone = 'Asia/Karachi';
    dto.defaultTaskPriority = TaskPriority.Medium;
    dto.defaultTaskStatus = TaskStatus.Pending;
    dto.emailNotifications = true;
    dto.taskAssignmentNotifications = false;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should pass validation when only some optional fields are provided', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    dto.timezone = 'Asia/Karachi';
    dto.emailNotifications = true;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a non-string timezone', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    (dto as any).timezone = 123;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'timezone')).toBe(true);
  });

  it('should reject an invalid default task priority', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    (dto as any).defaultTaskPriority = 'invalid-priority';

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'defaultTaskPriority'),
    ).toBe(true);
  });

  it('should reject an invalid default task status', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    (dto as any).defaultTaskStatus = 'invalid-status';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'defaultTaskStatus')).toBe(
      true,
    );
  });

  it('should reject a non-boolean emailNotifications value', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    (dto as any).emailNotifications = 'true';

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'emailNotifications'),
    ).toBe(true);
  });

  it('should reject a non-boolean taskAssignmentNotifications value', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    (dto as any).taskAssignmentNotifications = 'false';

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'taskAssignmentNotifications'),
    ).toBe(true);
  });

  it('should reject an invalid timezone type even when other fields are valid', async () => {
    const dto = new UpdateWorkspaceSettingsDto();

    (dto as any).timezone = true;
    dto.defaultTaskPriority = TaskPriority.Medium;
    dto.defaultTaskStatus = TaskStatus.Pending;
    dto.emailNotifications = true;
    dto.taskAssignmentNotifications = false;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'timezone')).toBe(true);
  });
});
