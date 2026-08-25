import { ApiHeader } from '@nestjs/swagger';
import {
  ApiIdempotencyKey,
  ApiIfMatch,
  ApiIfNoneMatch,
} from './api-headers.decorator';

jest.mock('@nestjs/swagger', () => ({
  ApiHeader: jest.fn(() => () => undefined),
}));

describe('API header decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ApiIdempotencyKey', () => {
    it('should configure the Idempotency-Key header correctly', () => {
      ApiIdempotencyKey();

      expect(ApiHeader).toHaveBeenCalledWith({
        name: 'Idempotency-Key',
        description:
          'Unique key used to safely retry the creation request. The same key cannot be reused with a different request payload.',
        required: true,
        schema: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          example: '7b9f3e2a-5f1c-4f4b-9d8d-123456789abc',
        },
      });
    });
  });

  describe('ApiIfMatch', () => {
    it('should configure the If-Match header correctly', () => {
      ApiIfMatch();

      expect(ApiHeader).toHaveBeenCalledWith({
        name: 'If-Match',
        description:
          'Expected resource version for optimistic concurrency control. Example: "3".',
        required: true,
        schema: {
          type: 'string',
          example: '"3"',
        },
      });
    });
  });

  describe('ApiIfNoneMatch', () => {
    it('should configure the If-None-Match header correctly', () => {
      ApiIfNoneMatch();

      expect(ApiHeader).toHaveBeenCalledWith({
        name: 'If-None-Match',
        description:
          'Previously received ETag. If the resource has not changed, the API returns 304 Not Modified.',
        required: false,
        schema: {
          type: 'string',
          example: '"3"',
        },
      });
    });
  });

  it('should call ApiHeader exactly once for each decorator factory', () => {
    ApiIdempotencyKey();
    ApiIfMatch();
    ApiIfNoneMatch();

    expect(ApiHeader).toHaveBeenCalledTimes(3);
  });
});
