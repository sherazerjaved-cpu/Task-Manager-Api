process.env.NODE_ENV = 'test';

process.env.MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/task-manager-test';

process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

console.log('TEST MONGODB_URI:', process.env.MONGODB_URI);
console.log('TEST REDIS_URL:', process.env.REDIS_URL);
