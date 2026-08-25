import { validate } from 'class-validator';

import { CreateTaskDto } from './create-task.dto';
import { TaskPriority } from '../Enums/task-priority.enum';
import { TaskStatus } from '../Enums/task-status.enum';

describe('CreateTaskDto', () => {
  const validWorkspaceId = '68a123456789abcdef123456';
  const validCategoryId = '68a123456789abcdef123457';

  const createValidDto = (): CreateTaskDto => {
    const dto = new CreateTaskDto();

    dto.title = 'Complete Backend Assignment';
    dto.description = 'Finish the remaining backend requirements.';
    dto.status = TaskStatus.Pending;
    dto.priority = TaskPriority.High;
    dto.dueDate = '2026-07-20T18:00:00.000Z';
    dto.category = validCategoryId;
    dto.tags = ['nestjs', 'backend', 'assignment'];
    dto.workspaceId = validWorkspaceId;

    return dto;
  };

  describe('valid input', () => {
    it('should pass validation with all valid fields', async () => {
      const dto = createValidDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only required fields', async () => {
      const dto = new CreateTaskDto();

      dto.title = 'Complete Backend Assignment';
      dto.workspaceId = validWorkspaceId;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept a valid title with exactly 3 characters', async () => {
      const dto = new CreateTaskDto();

      dto.title = 'ABC';
      dto.workspaceId = validWorkspaceId;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('title', () => {
    it('should reject a title shorter than 3 characters', async () => {
      const dto = new CreateTaskDto();

      dto.title = 'AB';
      dto.workspaceId = validWorkspaceId;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'title')).toBe(true);
    });

    it('should reject a non-string title', async () => {
      const dto = new CreateTaskDto();

      dto.title = 123 as any;
      dto.workspaceId = validWorkspaceId;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'title')).toBe(true);
    });

    it('should reject a missing title', async () => {
      const dto = new CreateTaskDto();

      dto.workspaceId = validWorkspaceId;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'title')).toBe(true);
    });
  });

  describe('status', () => {
    it('should accept a valid task status', async () => {
      const dto = createValidDto();

      dto.status = TaskStatus.Done;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'status')).toBe(false);
    });

    it('should reject an invalid task status', async () => {
      const dto = createValidDto();

      dto.status = 'invalid-status' as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'status')).toBe(true);
    });

    it('should accept an omitted status', async () => {
      const dto = createValidDto();

      dto.status = undefined;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'status')).toBe(false);
    });
  });

  describe('priority', () => {
    it('should accept a valid task priority', async () => {
      const dto = createValidDto();

      dto.priority = TaskPriority.Low;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'priority')).toBe(false);
    });

    it('should reject an invalid task priority', async () => {
      const dto = createValidDto();

      dto.priority = 'invalid-priority' as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'priority')).toBe(true);
    });

    it('should accept an omitted priority', async () => {
      const dto = createValidDto();

      dto.priority = undefined;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'priority')).toBe(false);
    });
  });

  describe('dueDate', () => {
    it('should accept a valid ISO date string', async () => {
      const dto = createValidDto();

      dto.dueDate = '2026-07-20T18:00:00.000Z';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'dueDate')).toBe(false);
    });

    it('should reject an invalid date string', async () => {
      const dto = createValidDto();

      dto.dueDate = 'not-a-date';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'dueDate')).toBe(true);
    });

    it('should accept an omitted due date', async () => {
      const dto = createValidDto();

      dto.dueDate = undefined;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'dueDate')).toBe(false);
    });
  });

  describe('category', () => {
    it('should accept a valid MongoDB ObjectId', async () => {
      const dto = createValidDto();

      dto.category = validCategoryId;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'category')).toBe(false);
    });

    it('should reject an invalid MongoDB ObjectId', async () => {
      const dto = createValidDto();

      dto.category = 'invalid-category-id';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'category')).toBe(true);
    });

    it('should accept an omitted category', async () => {
      const dto = createValidDto();

      dto.category = undefined;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'category')).toBe(false);
    });
  });

  describe('tags', () => {
    it('should accept an array of strings', async () => {
      const dto = createValidDto();

      dto.tags = ['nestjs', 'backend', 'mongodb'];

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'tags')).toBe(false);
    });

    it('should reject a non-array value', async () => {
      const dto = createValidDto();

      dto.tags = 'nestjs' as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'tags')).toBe(true);
    });

    it('should reject an array containing non-string values', async () => {
      const dto = createValidDto();

      dto.tags = ['nestjs', 123] as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'tags')).toBe(true);
    });

    it('should accept an omitted tags field', async () => {
      const dto = createValidDto();

      dto.tags = undefined;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'tags')).toBe(false);
    });
  });

  describe('workspaceId', () => {
    it('should accept a valid MongoDB ObjectId', async () => {
      const dto = createValidDto();

      dto.workspaceId = validWorkspaceId;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'workspaceId')).toBe(
        false,
      );
    });

    it('should reject an invalid MongoDB ObjectId', async () => {
      const dto = createValidDto();

      dto.workspaceId = 'invalid-workspace-id';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'workspaceId')).toBe(
        true,
      );
    });

    it('should reject a missing workspaceId', async () => {
      const dto = createValidDto();

      dto.workspaceId = undefined as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'workspaceId')).toBe(
        true,
      );
    });
  });
});
