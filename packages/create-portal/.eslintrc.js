module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  ignorePatterns: ['templates/**', 'templates-src/**', 'scripts/**'],
  rules: {
    'no-console': 0,
  },
});
