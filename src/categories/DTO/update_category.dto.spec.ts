import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { UpdateCategoryDto } from './update_category.dto';

describe('UpdateCategoryDto', () => {
  it('should accept an empty update payload', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept a valid name update', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      name: 'Updated Work',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept a valid color update', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      color: '#3498db',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept both name and color updates', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      name: 'Updated Work',
      color: '#2ecc71',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a non-string name', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      name: 123,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should reject a non-string color', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      color: 123,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('color');
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should reject an array as the name', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      name: ['Work'],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('should reject an object as the color', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      color: {
        value: '#3498db',
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('color');
  });
});
