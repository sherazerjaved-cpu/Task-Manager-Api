import { ApiHeader } from '@nestjs/swagger';

export function ApiIdempotencyKey() {
  return ApiHeader({
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
}

export function ApiIfMatch() {
  return ApiHeader({
    name: 'If-Match',
    description:
      'Expected resource version for optimistic concurrency control. Example: "3".',
    required: true,
    schema: {
      type: 'string',
      example: '"3"',
    },
  });
}

export function ApiIfNoneMatch() {
  return ApiHeader({
    name: 'If-None-Match',
    description:
      'Previously received ETag. If the resource has not changed, the API returns 304 Not Modified.',
    required: false,
    schema: {
      type: 'string',
      example: '"3"',
    },
  });
}
