import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',

  moduleFileExtensions: ['js', 'json', 'ts'],

  testRegex: '.*\\.spec\\.ts$|.*\\.integration-spec\\.ts$',

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
  ],

  coverageDirectory: './coverage',

  coverageReporters: [
    'text',
    'text-summary',
    'json-summary',
  ],

  testEnvironment: 'node',

  testPathIgnorePatterns: [
    '/node_modules/',
  ],

  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};

export default config;