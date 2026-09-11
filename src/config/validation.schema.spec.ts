import { validationSchema } from './validation.schema';

describe('validationSchema', () => {
  const createValidEnv = (): Record<string, unknown> => ({
    NODE_ENV: 'test',
    PORT: 3000,

    MONGODB_URI: 'mongodb://localhost:27017/task-manager',

    JWT_SECRET: 'jwt-secret',
    JWT_ACCESS_SECRET: 'jwt-access-secret',
    JWT_REFRESH_SECRET: 'jwt-refresh-secret',

    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',

    REMINDER_CRON: '*/5 * * * *',

    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_USER: 'smtp-user',
    SMTP_PASS: 'smtp-password',
    SMTP_FROM_EMAIL: 'noreply@example.com',
    SMTP_FROM_NAME: 'Task Manager',

    REDIS_URL: 'redis://localhost:6379',

    EXPORT_DOWNLOAD_SECRET: '12345678901234567890123456789012',
  });

  describe('valid configuration', () => {
    it('should accept a complete valid configuration', () => {
      const env = createValidEnv();

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(env);
    });

    it('should accept development NODE_ENV', () => {
      const env = createValidEnv();
      env.NODE_ENV = 'development';

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
    });

    it('should accept production NODE_ENV', () => {
      const env = createValidEnv();
      env.NODE_ENV = 'production';

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
    });

    it('should accept test NODE_ENV', () => {
      const env = createValidEnv();
      env.NODE_ENV = 'test';

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
    });
  });

  describe('NODE_ENV validation', () => {
    it('should reject an invalid NODE_ENV', () => {
      const env = createValidEnv();
      env.NODE_ENV = 'staging';

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('NODE_ENV');
    });

    it('should default NODE_ENV to development when omitted', () => {
      const env = createValidEnv();
      delete env.NODE_ENV;

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
      expect(result.value.NODE_ENV).toBe('development');
    });
  });

  describe('PORT validation', () => {
    it('should default PORT to 3000 when omitted', () => {
      const env = createValidEnv();
      delete env.PORT;

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
      expect(result.value.PORT).toBe(3000);
    });

    it('should reject a non-numeric PORT', () => {
      const env = createValidEnv();
      env.PORT = 'invalid';

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
    });
  });

  describe('required environment variables', () => {
    const requiredVariables = [
      'MONGODB_URI',
      'JWT_SECRET',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_ACCESS_EXPIRES_IN',
      'JWT_REFRESH_EXPIRES_IN',
      'REMINDER_CRON',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM_EMAIL',
      'SMTP_FROM_NAME',
      'REDIS_URL',
      'EXPORT_DOWNLOAD_SECRET',
    ];

    it.each(requiredVariables)(
      'should reject configuration when %s is missing',
      (variable) => {
        const env = createValidEnv();

        delete env[variable];

        const result = validationSchema.validate(env);

        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(variable);
      },
    );
  });

  describe('MONGODB_URI validation', () => {
    it('should reject a missing MONGODB_URI', () => {
      const env = createValidEnv();
      delete env.MONGODB_URI;

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
    });

    it('should accept a valid MongoDB URI', () => {
      const env = createValidEnv();
      env.MONGODB_URI = 'mongodb://localhost:27017/task-manager';

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
    });
  });

  describe('JWT configuration', () => {
    it('should reject missing JWT_SECRET', () => {
      const env = createValidEnv();
      delete env.JWT_SECRET;

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
    });

    it('should reject missing JWT_ACCESS_SECRET', () => {
      const env = createValidEnv();
      delete env.JWT_ACCESS_SECRET;

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
    });

    it('should reject missing JWT_REFRESH_SECRET', () => {
      const env = createValidEnv();
      delete env.JWT_REFRESH_SECRET;

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
    });

    it('should reject missing JWT_ACCESS_EXPIRES_IN', () => {
      const env = createValidEnv();
      delete env.JWT_ACCESS_EXPIRES_IN;

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
    });

    it('should reject missing JWT_REFRESH_EXPIRES_IN', () => {
      const env = createValidEnv();
      delete env.JWT_REFRESH_EXPIRES_IN;

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
    });
  });

  describe('SMTP configuration', () => {
    it('should reject an invalid SMTP_PORT', () => {
      const env = createValidEnv();
      env.SMTP_PORT = 'invalid';

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
    });

    it('should reject an invalid SMTP_FROM_EMAIL', () => {
      const env = createValidEnv();
      env.SMTP_FROM_EMAIL = 'not-an-email';

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('SMTP_FROM_EMAIL');
    });

    it('should accept a valid SMTP_FROM_EMAIL', () => {
      const env = createValidEnv();
      env.SMTP_FROM_EMAIL = 'valid@example.com';

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
    });
  });

  describe('REDIS_URL validation', () => {
    it('should reject an invalid REDIS_URL', () => {
      const env = createValidEnv();
      env.REDIS_URL = 'not-a-url';

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('REDIS_URL');
    });

    it('should accept a valid Redis URL', () => {
      const env = createValidEnv();
      env.REDIS_URL = 'redis://localhost:6379';

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
    });
  });

  describe('EXPORT_DOWNLOAD_SECRET validation', () => {
    it('should reject a secret shorter than 32 characters', () => {
      const env = createValidEnv();
      env.EXPORT_DOWNLOAD_SECRET = 'short-secret';

      const result = validationSchema.validate(env);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('EXPORT_DOWNLOAD_SECRET');
    });

    it('should accept a secret with exactly 32 characters', () => {
      const env = createValidEnv();
      env.EXPORT_DOWNLOAD_SECRET = 'a'.repeat(32);

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
    });

    it('should accept a secret longer than 32 characters', () => {
      const env = createValidEnv();
      env.EXPORT_DOWNLOAD_SECRET = 'a'.repeat(64);

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
    });
  });

  describe('default values', () => {
    it('should apply the default NODE_ENV and PORT', () => {
      const env = createValidEnv();

      delete env.NODE_ENV;
      delete env.PORT;

      const result = validationSchema.validate(env);

      expect(result.error).toBeUndefined();
      expect(result.value.NODE_ENV).toBe('development');
      expect(result.value.PORT).toBe(3000);
    });
  });
});
