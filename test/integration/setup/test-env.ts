process.env.NODE_ENV = 'test';

process.env.PORT = process.env.PORT ?? '3000';

process.env.MONGODB_URI =
  process.env.MONGODB_URI ??
  'mongodb://localhost:27017/task-manager-test?replicaSet=rs0&directConnection=true';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-jwt-access-secret';

process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-jwt-refresh-secret';

process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';

process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

process.env.REMINDER_CRON = process.env.REMINDER_CRON ?? '* * * * *';

process.env.SMTP_HOST = process.env.SMTP_HOST ?? 'localhost';

process.env.SMTP_PORT = process.env.SMTP_PORT ?? '1025';

process.env.SMTP_USER = process.env.SMTP_USER ?? 'test';

process.env.SMTP_PASS = process.env.SMTP_PASS ?? 'test';

process.env.SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL ?? 'test@example.com';

process.env.SMTP_FROM_NAME = process.env.SMTP_FROM_NAME ?? 'Task Manager Test';

process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

process.env.EXPORT_DOWNLOAD_SECRET =
  process.env.EXPORT_DOWNLOAD_SECRET ??
  'test-export-download-secret-key-32-chars';
