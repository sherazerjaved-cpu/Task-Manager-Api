import { validate } from 'class-validator';

import { AssignTaskDto } from './assign-task.dto';

describe('AssignTaskDto', () => {
  it('should accept a valid array of MongoDB IDs', async () => {
    const dto = new AssignTaskDto();

    dto.userIds = ['68a123456789abcdef123456', '68a123456789abcdef123457'];

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject when userIds is not an array', async () => {
    const dto = new AssignTaskDto();

    dto.userIds = '68a123456789abcdef123456' as any;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0].property).toBe('userIds');

    expect(errors[0].constraints).toHaveProperty('isArray');
  });

  it('should reject an empty array', async () => {
    const dto = new AssignTaskDto();

    dto.userIds = [];

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0].property).toBe('userIds');

    expect(errors[0].constraints).toHaveProperty('arrayMinSize');
  });

  it('should reject an array containing an invalid MongoDB ID', async () => {
    const dto = new AssignTaskDto();

    dto.userIds = ['68a123456789abcdef123456', 'invalid-user-id'];

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0].property).toBe('userIds');

    expect(errors[0].constraints).toHaveProperty('isMongoId');
  });

  it('should reject when all IDs are invalid', async () => {
    const dto = new AssignTaskDto();

    dto.userIds = ['invalid-id-1', 'invalid-id-2'];

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0].property).toBe('userIds');

    expect(errors[0].constraints).toHaveProperty('isMongoId');
  });

  it('should accept exactly one valid user ID', async () => {
    const dto = new AssignTaskDto();

    dto.userIds = ['68a123456789abcdef123456'];

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a non-string value inside the array', async () => {
    const dto = new AssignTaskDto();

    dto.userIds = [123456 as any];

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0].property).toBe('userIds');

    expect(errors[0].constraints).toHaveProperty('isMongoId');
  });
});
