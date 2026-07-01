module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  // The Storybook build output is gitignored but not covered by the backstage
  // eslint config's ignores (only dist/**), so `package lint` would otherwise
  // try to parse its multi-MB minified bundles and blow up the heap.
  ignorePatterns: ['storybook-static/**'],
});
