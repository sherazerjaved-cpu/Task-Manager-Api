import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new LoginDto();

    dto.email = 'john@example.com';
    dto.password = 'Password123';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid email', async () => {
    const dto = new LoginDto();

    dto.email = 'invalid-email';
    dto.password = 'Password123';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
    expect(errors[0].constraints).toHaveProperty('isEmail');
  });

  it('should reject a non-string password', async () => {
    const dto = new LoginDto();

    dto.email = 'john@example.com';
    dto.password = 12345 as any;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should reject a non-string email', async () => {
    const dto = new LoginDto();

    dto.email = 12345 as any;
    dto.password = 'Password123';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('should reject when email is missing', async () => {
    const dto = new LoginDto();

    dto.password = 'Password123';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('should reject when password is missing', async () => {
    const dto = new LoginDto();

    dto.email = 'john@example.com';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
