import { validate } from 'class-validator';
import { CreateWorkspaceDto } from './create-workspace.dto';

describe('CreateWorkspaceDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new CreateWorkspaceDto();

    dto.name = 'Backend Development Team';
    dto.slug = 'backend-development';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  describe('name', () => {
    it('should fail when name is missing', async () => {
      const dto = new CreateWorkspaceDto();

      dto.slug = 'backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
    });

    it('should fail when name is empty', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = '';
      dto.slug = 'backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
    });

    it('should fail when name is not a string', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 12345 as any;
      dto.slug = 'backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
    });

    it('should fail when name is shorter than 2 characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'A';
      dto.slug = 'backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
    });

    it('should fail when name exceeds 100 characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'A'.repeat(101);
      dto.slug = 'backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
    });

    it('should accept a name with exactly 2 characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'AB';
      dto.slug = 'backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept a name with exactly 100 characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'A'.repeat(100);
      dto.slug = 'backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('slug', () => {
    it('should fail when slug is missing', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug is empty', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = '';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug is not a string', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 12345 as any;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug is shorter than 2 characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'a';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug exceeds 100 characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'a'.repeat(101);

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug contains uppercase letters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'Backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug contains spaces', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'backend development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug starts with a hyphen', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = '-backend-development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug ends with a hyphen', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'backend-development-';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug contains consecutive hyphens', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'backend--development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should fail when slug contains special characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'backend_development';

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('slug');
    });

    it('should accept lowercase letters and numbers', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'backend123';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept hyphen-separated lowercase words', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'backend-development-123';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept a slug with exactly 2 characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'ab';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept a slug with exactly 100 characters', async () => {
      const dto = new CreateWorkspaceDto();

      dto.name = 'Backend Development Team';
      dto.slug = 'a'.repeat(100);

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
