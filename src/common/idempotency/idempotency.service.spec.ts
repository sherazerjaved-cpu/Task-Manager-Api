import { IdempotencyService } from './idempotency.service';
import {
  IDEMPOTENCY_REDIS_PREFIX,
  IDEMPOTENCY_TTL_SECONDS,
} from './idempotency.constants';

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new IdempotencyService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reserve', () => {
    it('should reserve a new idempotency key', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.reserve(
        'user-123:POST:/api/v1/tasks',
        'key-123',
        'fingerprint-123',
      );

      expect(result).toEqual({
        acquired: true,
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        `${IDEMPOTENCY_REDIS_PREFIX}:user-123:POST:/api/v1/tasks:key-123`,
        JSON.stringify({
          status: 'PROCESSING',
          fingerprint: 'fingerprint-123',
        }),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
        'NX',
      );
    });

    it('should return an existing record when the key is already reserved', async () => {
      const existingRecord = {
        status: 'PROCESSING',
        fingerprint: 'fingerprint-123',
      };

      mockRedis.set.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(JSON.stringify(existingRecord));

      const result = await service.reserve(
        'user-123:POST:/api/v1/tasks',
        'key-123',
        'fingerprint-123',
      );

      expect(result).toEqual({
        acquired: false,
        record: existingRecord,
      });

      expect(mockRedis.get).toHaveBeenCalledWith(
        `${IDEMPOTENCY_REDIS_PREFIX}:user-123:POST:/api/v1/tasks:key-123`,
      );
    });

    it('should return undefined record when the existing Redis record does not exist', async () => {
      mockRedis.set.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.reserve(
        'user-123:POST:/api/v1/tasks',
        'key-123',
        'fingerprint-123',
      );

      expect(result).toEqual({
        acquired: false,
        record: undefined,
      });
    });

    it('should store the record as PROCESSING', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.reserve(
        'workspace-123:POST:/tasks',
        'idempotency-key',
        'abc123',
      );

      const storedValue = mockRedis.set.mock.calls[0][1];

      expect(JSON.parse(storedValue)).toEqual({
        status: 'PROCESSING',
        fingerprint: 'abc123',
      });
    });

    it('should use NX when reserving the key', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.reserve('scope', 'key', 'fingerprint');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
        'NX',
      );
    });

    it('should use the configured idempotency TTL when reserving', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.reserve('scope', 'key', 'fingerprint');

      expect(mockRedis.set.mock.calls[0][3]).toBe(IDEMPOTENCY_TTL_SECONDS);
    });
  });

  describe('get', () => {
    it('should return the stored idempotency record', async () => {
      const record = {
        status: 'COMPLETED',
        fingerprint: 'fingerprint-123',
        statusCode: 201,
        responseBody: {
          id: 'task-123',
        },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(record));

      const result = await service.get(
        'user-123:POST:/api/v1/tasks',
        'key-123',
      );

      expect(result).toEqual(record);

      expect(mockRedis.get).toHaveBeenCalledWith(
        `${IDEMPOTENCY_REDIS_PREFIX}:user-123:POST:/api/v1/tasks:key-123`,
      );
    });

    it('should return null when the record does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get(
        'user-123:POST:/api/v1/tasks',
        'key-123',
      );

      expect(result).toBeNull();
    });

    it('should deserialize the Redis JSON value', async () => {
      const record = {
        status: 'PROCESSING',
        fingerprint: 'abc123',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(record));

      const result = await service.get('scope', 'key');

      expect(result).toEqual(record);
      expect(typeof result).toBe('object');
    });

    it('should return null when Redis returns an empty value', async () => {
      mockRedis.get.mockResolvedValue('');

      const result = await service.get('scope', 'key');

      expect(result).toBeNull();
    });
  });

  describe('complete', () => {
    it('should mark the idempotency record as COMPLETED', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const record = {
        status: 'PROCESSING' as const,
        fingerprint: 'fingerprint-123',
        statusCode: 201,
        responseBody: {
          id: 'task-123',
        },
      };

      await service.complete('user-123:POST:/api/v1/tasks', 'key-123', record);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `${IDEMPOTENCY_REDIS_PREFIX}:user-123:POST:/api/v1/tasks:key-123`,
        JSON.stringify({
          status: 'COMPLETED',
          fingerprint: 'fingerprint-123',
          statusCode: 201,
          responseBody: {
            id: 'task-123',
          },
        }),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
      );
    });

    it('should preserve the fingerprint when completing the record', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const record = {
        status: 'PROCESSING' as const,
        fingerprint: 'sha256-fingerprint',
      };

      await service.complete('scope', 'key', record);

      const storedValue = mockRedis.set.mock.calls[0][1];

      expect(JSON.parse(storedValue)).toEqual({
        status: 'COMPLETED',
        fingerprint: 'sha256-fingerprint',
      });
    });

    it('should preserve the response status code and response body', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const record = {
        status: 'PROCESSING' as const,
        fingerprint: 'fingerprint',
        statusCode: 200,
        responseBody: {
          id: '123',
          title: 'Test task',
        },
      };

      await service.complete('scope', 'key', record);

      const storedValue = mockRedis.set.mock.calls[0][1];

      expect(JSON.parse(storedValue)).toEqual({
        status: 'COMPLETED',
        fingerprint: 'fingerprint',
        statusCode: 200,
        responseBody: {
          id: '123',
          title: 'Test task',
        },
      });
    });

    it('should use the configured TTL when completing the record', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.complete('scope', 'key', {
        status: 'PROCESSING',
        fingerprint: 'fingerprint',
      });

      expect(mockRedis.set.mock.calls[0][3]).toBe(IDEMPOTENCY_TTL_SECONDS);
    });
  });

  describe('delete', () => {
    it('should delete the idempotency record', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.delete('user-123:POST:/api/v1/tasks', 'key-123');

      expect(mockRedis.del).toHaveBeenCalledWith(
        `${IDEMPOTENCY_REDIS_PREFIX}:user-123:POST:/api/v1/tasks:key-123`,
      );
    });

    it('should call Redis DEL exactly once', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.delete('scope', 'key');

      expect(mockRedis.del).toHaveBeenCalledTimes(1);
    });

    it('should work when the key does not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(
        service.delete('scope', 'non-existent-key'),
      ).resolves.toBeUndefined();

      expect(mockRedis.del).toHaveBeenCalledWith(
        `${IDEMPOTENCY_REDIS_PREFIX}:scope:non-existent-key`,
      );
    });
  });

  describe('Redis key generation', () => {
    it('should include the configured Redis prefix', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.get('scope', 'key');

      expect(mockRedis.get).toHaveBeenCalledWith(
        `${IDEMPOTENCY_REDIS_PREFIX}:scope:key`,
      );
    });

    it('should include both scope and idempotency key', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.get('user-123:POST:/api/v1/tasks', 'unique-key');

      expect(mockRedis.get).toHaveBeenCalledWith(
        `${IDEMPOTENCY_REDIS_PREFIX}:user-123:POST:/api/v1/tasks:unique-key`,
      );
    });
  });
});
