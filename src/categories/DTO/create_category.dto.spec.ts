import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { CreateCategryDto } from './create_category.dto';

describe('CreateCategryDto', () => {
  it('should accept a valid category', async () => {
    const dto = plainToInstance(CreateCategryDto, {
      name: 'Work',
      color: '#3498db',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept a category without a color', async () => {
    const dto = plainToInstance(CreateCategryDto, {
      name: 'Work',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject when name is missing', async () => {
    const dto = plainToInstance(CreateCategryDto, {
      color: '#3498db',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('should reject when name is not a string', async () => {
    const dto = plainToInstance(CreateCategryDto, {
      name: 123,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should reject when color is not a string', async () => {
    const dto = plainToInstance(CreateCategryDto, {
      name: 'Work',
      color: 123,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('color');
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should accept an empty color only if validation considers it a string', async () => {
    const dto = plainToInstance(CreateCategryDto, {
      name: 'Work',
      color: '',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject when name is an array', async () => {
    const dto = plainToInstance(CreateCategryDto, {
      name: ['Work'],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('should reject when color is an object', async () => {
    const dto = plainToInstance(CreateCategryDto, {
      name: 'Work',
      color: {
        value: '#3498db',
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('color');
  });
});
