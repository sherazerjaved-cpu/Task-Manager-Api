import { validate } from 'class-validator';
import { RefreshTokenDto } from './refresh_token.dto';

describe('RefreshTokenDto', () => {
  it('should pass validation with a valid refresh token', async () => {
    const dto = new RefreshTokenDto();

    dto.refresh_token = 'valid-refresh-token';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a non-string refresh token', async () => {
    const dto = new RefreshTokenDto();

    dto.refresh_token = 12345 as any;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('refresh_token');
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should reject a missing refresh token', async () => {
    const dto = new RefreshTokenDto();

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'refresh_token')).toBe(
      true,
    );
  });
});
