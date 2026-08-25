import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GetTasksQueryDto } from './get-task-query.dto';

describe('GetTasksQueryDto', () => {
  const validWorkspaceId = '68a123456789abcdef123456';
  const validCursor = '68a123456789abcdef123457';

  const createValidDto = (): GetTasksQueryDto => {
    return plainToInstance(GetTasksQueryDto, {
      page: 1,
      limit: 10,
      status: 'pending',
      search: 'assignment',
      sort: 'priority:desc,dueDate:asc',
      sortBy: 'dueDate',
      order: 'asc',
      dueFrom: '2026-07-01',
      dueTo: '2026-07-31',
      cursor: validCursor,
      tags: 'nestjs',
      pagination: 'offset',
      assignee: 'me',
      workspaceId: validWorkspaceId,
    });
  };

  describe('valid input', () => {
    it('should pass validation with all valid fields', async () => {
      const dto = createValidDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with no optional fields', async () => {
      const dto = new GetTasksQueryDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should use the default pagination values', () => {
      const dto = new GetTasksQueryDto();

      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
      expect(dto.pagination).toBe('offset');
    });
  });

  describe('page', () => {
    it('should accept a valid page number', async () => {
      const dto = plainToInstance(GetTasksQueryDto, {
        page: 2,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
    });

    it('should transform a numeric string into a number', async () => {
      const dto = plainToInstance(GetTasksQueryDto, {
        page: '3',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(3);
      expect(typeof dto.page).toBe('number');
    });

    it('should reject page less than 1', async () => {
      const dto = plainToInstance(GetTasksQueryDto, {
        page: 0,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'page')).toBe(true);
    });

    it('should reject a non-integer page', async () => {
      const dto = plainToInstance(GetTasksQueryDto, {
        page: 1.5,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'page')).toBe(true);
    });
  });

  describe('limit', () => {
    it('should accept a valid limit', async () => {
      const dto = plainToInstance(GetTasksQueryDto, {
        limit: 20,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should transform a numeric string into a number', async () => {
      const dto = plainToInstance(GetTasksQueryDto, {
        limit: '25',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(25);
      expect(typeof dto.limit).toBe('number');
    });

    it('should reject limit less than 1', async () => {
      const dto = plainToInstance(GetTasksQueryDto, {
        limit: 0,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });

    it('should reject a non-integer limit', async () => {
      const dto = plainToInstance(GetTasksQueryDto, {
        limit: 1.5,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });
  });

  describe('string fields', () => {
    it.each(['status', 'search', 'sort', 'sortBy', 'tags', 'assignee'])(
      'should accept a valid string for %s',
      async (field) => {
        const dto = new GetTasksQueryDto();

        (dto as any)[field] = 'test';

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === field)).toBe(false);
      },
    );

    it('should reject a non-string status', async () => {
      const dto = new GetTasksQueryDto();

      dto.status = 123 as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'status')).toBe(true);
    });

    it('should reject a non-string search', async () => {
      const dto = new GetTasksQueryDto();

      dto.search = 123 as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'search')).toBe(true);
    });

    it('should reject a non-string sort', async () => {
      const dto = new GetTasksQueryDto();

      dto.sort = 123 as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'sort')).toBe(true);
    });
  });

  describe('order', () => {
    it.each(['asc', 'desc'])('should accept %s', async (order) => {
      const dto = new GetTasksQueryDto();

      dto.order = order as 'asc' | 'desc';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'order')).toBe(false);
    });

    it('should reject an invalid order', async () => {
      const dto = new GetTasksQueryDto();

      dto.order = 'invalid' as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'order')).toBe(true);
    });
  });

  describe('dueFrom and dueTo', () => {
    it('should accept valid date strings', async () => {
      const dto = new GetTasksQueryDto();

      dto.dueFrom = '2026-07-01';
      dto.dueTo = '2026-07-31';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid dueFrom date', async () => {
      const dto = new GetTasksQueryDto();

      dto.dueFrom = 'not-a-date';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'dueFrom')).toBe(true);
    });

    it('should reject an invalid dueTo date', async () => {
      const dto = new GetTasksQueryDto();

      dto.dueTo = 'not-a-date';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'dueTo')).toBe(true);
    });
  });

  describe('cursor', () => {
    it('should accept a valid MongoDB ObjectId', async () => {
      const dto = new GetTasksQueryDto();

      dto.cursor = validCursor;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'cursor')).toBe(false);
    });

    it('should reject an invalid MongoDB ObjectId', async () => {
      const dto = new GetTasksQueryDto();

      dto.cursor = 'invalid-cursor';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'cursor')).toBe(true);
    });
  });

  describe('pagination', () => {
    it.each(['offset', 'cursor'])('should accept %s', async (pagination) => {
      const dto = new GetTasksQueryDto();

      dto.pagination = pagination as 'offset' | 'cursor';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'pagination')).toBe(
        false,
      );
    });

    it('should reject an invalid pagination strategy', async () => {
      const dto = new GetTasksQueryDto();

      dto.pagination = 'invalid' as any;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'pagination')).toBe(
        true,
      );
    });
  });

  describe('workspaceId', () => {
    it('should accept a valid MongoDB ObjectId', async () => {
      const dto = new GetTasksQueryDto();

      dto.workspaceId = validWorkspaceId;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'workspaceId')).toBe(
        false,
      );
    });

    it('should reject an invalid MongoDB ObjectId', async () => {
      const dto = new GetTasksQueryDto();

      dto.workspaceId = 'invalid-workspace-id';

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'workspaceId')).toBe(
        true,
      );
    });
  });

  describe('optional fields', () => {
    it('should accept omitted optional fields', async () => {
      const dto = new GetTasksQueryDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept an omitted workspaceId', async () => {
      const dto = new GetTasksQueryDto();

      dto.workspaceId = undefined;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept an omitted cursor', async () => {
      const dto = new GetTasksQueryDto();

      dto.cursor = undefined;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
