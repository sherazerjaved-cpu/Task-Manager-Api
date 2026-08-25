import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { GetAuditLogsDto } from './get-audit-logs.dto';

describe('GetAuditLogsDto', () => {
  describe('default values', () => {
    it('should default page to 1 and limit to 20', () => {
      const dto = new GetAuditLogsDto();

      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });
  });

  describe('valid values', () => {
    it('should accept valid page and limit values', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 2,
        limit: 50,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(50);
    });

    it('should accept page 1 and limit 1', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 1,
        limit: 1,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept limit 100', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 1,
        limit: 100,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('class-transformer', () => {
    it('should transform string page and limit values into numbers', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: '3',
        limit: '25',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(25);
      expect(typeof dto.page).toBe('number');
      expect(typeof dto.limit).toBe('number');
    });
  });

  describe('page validation', () => {
    it('should reject page 0', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 0,
        limit: 20,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
    });

    it('should reject negative page values', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: -1,
        limit: 20,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
    });

    it('should reject non-integer page values', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 1.5,
        limit: 20,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
    });

    it('should reject non-numeric page values', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 'abc',
        limit: 20,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
    });
  });

  describe('limit validation', () => {
    it('should reject limit 0', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 1,
        limit: 0,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
    });

    it('should reject negative limit values', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 1,
        limit: -1,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
    });

    it('should reject limit values greater than 100', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 1,
        limit: 101,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
    });

    it('should reject non-integer limit values', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 1,
        limit: 10.5,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
    });

    it('should reject non-numeric limit values', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {
        page: 1,
        limit: 'abc',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
    });
  });

  describe('optional fields', () => {
    it('should allow page and limit to be omitted', async () => {
      const dto = plainToInstance(GetAuditLogsDto, {});

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });
  });
});
