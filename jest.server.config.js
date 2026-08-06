/**
 * Backend test config, kept separate from `react-app-rewired test` so the two
 * runners don't collide (CRA owns the jest config for anything under src/).
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/server/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.js'],
  // First run downloads a mongod binary for mongodb-memory-server.
  testTimeout: 30000,
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/index.js',
    '!server/__tests__/**',
  ],
  // Surface anything that leaks a handle instead of hanging silently.
  detectOpenHandles: true,
  forceExit: false,
};
