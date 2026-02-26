/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'availability_controller.js',
    'services/**/*.js',
    'routes/**/*.js',
    'event_management/**/*.js',
    'algorithm/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 40,
      lines: 40,
      statements: 40
    },
    './services/': {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    },
    './routes/': {
      branches: 55,
      functions: 60,
      lines: 55,
      statements: 55
    }
  }
};
