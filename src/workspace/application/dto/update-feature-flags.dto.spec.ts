import { validate } from 'class-validator';
import { UpdateFeatureFlagsDto } from './update-feature-flags.dto';

describe('UpdateFeatureFlagsDto', () => {
  it('should pass validation when no fields are provided', async () => {
    const dto = new UpdateFeatureFlagsDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should pass validation when all fields are valid booleans', async () => {
    const dto = new UpdateFeatureFlagsDto();

    dto.webhooks = true;
    dto.exports = false;
    dto.reminders = true;
    dto.emailNotifications = false;
    dto.advancedTaskFiltering = true;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should pass validation when only some optional fields are provided', async () => {
    const dto = new UpdateFeatureFlagsDto();

    dto.webhooks = true;
    dto.reminders = false;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a non-boolean webhooks value', async () => {
    const dto = new UpdateFeatureFlagsDto();

    (dto as any).webhooks = 'true';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'webhooks')).toBe(true);
  });

  it('should reject a non-boolean exports value', async () => {
    const dto = new UpdateFeatureFlagsDto();

    (dto as any).exports = 'false';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'exports')).toBe(true);
  });

  it('should reject a non-boolean reminders value', async () => {
    const dto = new UpdateFeatureFlagsDto();

    (dto as any).reminders = 'true';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reminders')).toBe(true);
  });

  it('should reject a non-boolean emailNotifications value', async () => {
    const dto = new UpdateFeatureFlagsDto();

    (dto as any).emailNotifications = 'false';

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'emailNotifications'),
    ).toBe(true);
  });

  it('should reject a non-boolean advancedTaskFiltering value', async () => {
    const dto = new UpdateFeatureFlagsDto();

    (dto as any).advancedTaskFiltering = 'true';

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'advancedTaskFiltering'),
    ).toBe(true);
  });
});
