import { validate } from 'class-validator';

import { UpdateTaskDto } from './update-task.dto';
import { TaskPriority } from '../Enums/task-priority.enum';
import { TaskStatus } from '../Enums/task-status.enum';

describe('UpdateTaskDto', () => {
  const createValidDto = (): UpdateTaskDto => {
    const dto = new UpdateTaskDto();

    dto.title = 'Updated Task';
    dto.description = 'Updated description';
    dto.status = TaskStatus.Done;
    dto.priority = TaskPriority.High;
    dto.dueDate = '2026-08-20T18:00:00.000Z';
    dto.category = '686f4c7ef8f64e95d25f6b7d';
    dto.tags = ['nestjs', 'backend'];

    return dto;
  };

  describe('valid data', () => {
    it('should pass validation with all valid fields', async () => {
      const dto = createValidDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with an empty DTO', async () => {
      const dto = new UpdateTaskDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation when only one optional field is provided', async () => {
      const dto = new UpdateTaskDto();
      dto.title = 'Updated Task';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('title', () => {
    it('should reject a title shorter than 3 characters', async () => {
      const dto = new UpdateTaskDto();
      dto.title = 'AB';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('title');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should reject a non-string title', async () => {
      const dto = new UpdateTaskDto();
      dto.title = 123 as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('title');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should accept a title with exactly 3 characters', async () => {
      const dto = new UpdateTaskDto();
      dto.title = 'ABC';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('description', () => {
    it('should accept a valid description', async () => {
      const dto = new UpdateTaskDto();
      dto.description = 'Updated description';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject a non-string description', async () => {
      const dto = new UpdateTaskDto();
      dto.description = 123 as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('status', () => {
    it('should accept a valid TaskStatus', async () => {
      const dto = new UpdateTaskDto();
      dto.status = TaskStatus.Done;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid status', async () => {
      const dto = new UpdateTaskDto();
      dto.status = 'invalid-status' as TaskStatus;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });
  });

  describe('priority', () => {
    it('should accept a valid TaskPriority', async () => {
      const dto = new UpdateTaskDto();
      dto.priority = TaskPriority.High;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid priority', async () => {
      const dto = new UpdateTaskDto();
      dto.priority = 'invalid-priority' as TaskPriority;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('priority');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });
  });

  describe('dueDate', () => {
    it('should accept a valid ISO date string', async () => {
      const dto = new UpdateTaskDto();
      dto.dueDate = '2026-08-20T18:00:00.000Z';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid date string', async () => {
      const dto = new UpdateTaskDto();
      dto.dueDate = 'not-a-date';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('dueDate');
      expect(errors[0].constraints).toHaveProperty('isDateString');
    });
  });

  describe('category', () => {
    it('should accept a valid MongoDB ObjectId', async () => {
      const dto = new UpdateTaskDto();
      dto.category = '686f4c7ef8f64e95d25f6b7d';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid MongoDB ObjectId', async () => {
      const dto = new UpdateTaskDto();
      dto.category = 'invalid-id';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('category');
      expect(errors[0].constraints).toHaveProperty('isMongoId');
    });
  });

  describe('tags', () => {
    it('should accept an array of strings', async () => {
      const dto = new UpdateTaskDto();
      dto.tags = ['nestjs', 'backend', 'task-manager'];

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject a non-array tags value', async () => {
      const dto = new UpdateTaskDto();
      dto.tags = 'nestjs' as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tags');
      expect(errors[0].constraints).toHaveProperty('isArray');
    });

    it('should reject tags containing non-string values', async () => {
      const dto = new UpdateTaskDto();
      dto.tags = ['nestjs', 123, true] as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tags');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('optional fields', () => {
    it('should allow all fields to be omitted', async () => {
      const dto = new UpdateTaskDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
