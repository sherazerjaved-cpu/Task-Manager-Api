import { validate } from 'class-validator';
import { CreateExportDto } from './create-export.dto';

describe('CreateExportDto', () => {
  describe('format validation', () => {
    it('should accept json format', async () => {
      const dto = new CreateExportDto();
      dto.format = 'json';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept csv format', async () => {
      const dto = new CreateExportDto();
      dto.format = 'csv';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept xlsx format', async () => {
      const dto = new CreateExportDto();
      dto.format = 'xlsx';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject an unsupported format', async () => {
      const dto = new CreateExportDto();
      dto.format = 'pdf' as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('format');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should reject a non-string format', async () => {
      const dto = new CreateExportDto();
      dto.format = 123 as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('format');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should reject an empty format', async () => {
      const dto = new CreateExportDto();
      dto.format = '' as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('format');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should reject an uppercase format', async () => {
      const dto = new CreateExportDto();
      dto.format = 'CSV' as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('format');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should reject null format', async () => {
      const dto = new CreateExportDto();
      dto.format = null as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('format');
    });

    it('should reject undefined format', async () => {
      const dto = new CreateExportDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('format');
    });
  });

  describe('valid DTO', () => {
    it('should have no validation errors for a valid export request', async () => {
      const dto = new CreateExportDto();
      dto.format = 'csv';

      const errors = await validate(dto);

      expect(errors).toEqual([]);
    });
  });
});
