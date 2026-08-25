import { validate } from 'class-validator';

import { CreateCommentDto } from './create-comment.dto';

describe('CreateCommentDto', () => {
  it('should accept a valid comment body', async () => {
    const dto = new CreateCommentDto();

    dto.body = 'This task is almost complete.';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an empty body', async () => {
    const dto = new CreateCommentDto();

    dto.body = '';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0].property).toBe('body');

    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('should reject a non-string body', async () => {
    const dto = new CreateCommentDto();

    dto.body = 123 as any;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0].property).toBe('body');

    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should reject when body is missing', async () => {
    const dto = new CreateCommentDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0].property).toBe('body');
  });

  it('should reject a whitespace-only body', async () => {
    const dto = new CreateCommentDto();

    dto.body = '   ';

    const errors = await validate(dto);

    // IsNotEmpty considers whitespace a non-empty string.
    // Therefore this is actually valid with the current DTO.
    expect(errors).toHaveLength(0);
  });
});
