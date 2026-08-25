import { validate } from 'class-validator';
import { CreateWebhookDto } from './create-webhook.dto';

describe('CreateWebhookDto', () => {
  const createDto = (
    overrides: Partial<CreateWebhookDto> = {},
  ): CreateWebhookDto => {
    const dto = new CreateWebhookDto();

    dto.url = 'https://example.com/webhooks/task-events';
    dto.events = ['task.created', 'task.updated'];

    Object.assign(dto, overrides);

    return dto;
  };

  it('should accept a valid webhook DTO', async () => {
    const dto = createDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  describe('url', () => {
    it('should accept a valid HTTP URL', async () => {
      const dto = createDto({
        url: 'http://example.com/webhook',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should accept a valid HTTPS URL', async () => {
      const dto = createDto({
        url: 'https://example.com/webhook',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid URL', async () => {
      const dto = createDto({
        url: 'not-a-url',
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'url')).toBe(true);
    });

    it('should reject a URL without a protocol', async () => {
      const dto = createDto({
        url: 'example.com/webhook',
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'url')).toBe(true);
    });

    it('should reject an empty URL', async () => {
      const dto = createDto({
        url: '',
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'url')).toBe(true);
    });
  });

  describe('events', () => {
    it('should accept a non-empty array of strings', async () => {
      const dto = createDto({
        events: ['task.created', 'task.updated', 'task.deleted'],
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject an empty events array', async () => {
      const dto = createDto({
        events: [],
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'events')).toBe(true);
    });

    it('should reject events when it is not an array', async () => {
      const dto = createDto({
        events: 'task.created' as any,
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'events')).toBe(true);
    });

    it('should reject an array containing non-string values', async () => {
      const dto = createDto({
        events: ['task.created', 123, true] as any,
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'events')).toBe(true);
    });
  });
});
