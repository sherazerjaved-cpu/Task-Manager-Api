import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new RegisterDto();

    dto.email = 'john@example.com';
    dto.password = 'Password123';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid email', async () => {
    const dto = new RegisterDto();

    dto.email = 'invalid-email';
    dto.password = 'Password123';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
    expect(errors[0].constraints).toHaveProperty('isEmail');
  });

  it('should reject a password shorter than 6 characters', async () => {
    const dto = new RegisterDto();

    dto.email = 'john@example.com';
    dto.password = '12345';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should accept a password with exactly 6 characters', async () => {
    const dto = new RegisterDto();

    dto.email = 'john@example.com';
    dto.password = '123456';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject when email is missing', async () => {
    const dto = new RegisterDto();

    dto.password = 'Password123';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('should reject when password is missing', async () => {
    const dto = new RegisterDto();

    dto.email = 'john@example.com';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
