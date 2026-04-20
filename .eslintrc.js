// Guardrail: colors must flow through theme tokens, never literals.
// Defined in `packages/design-system/src/theme/tokens.ts`. If you need a
// color that isn't yet a token, add it there — don't inline hex or rgba.
const colorLiteralRules = [
  {
    selector:
      "Literal[value=/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?$/]",
    message:
      'Use theme tokens (useChoreoTokens / theme.palette / lightTokens / darkTokens) instead of hardcoded hex colors. Add a token in packages/design-system/src/theme/tokens.ts if needed.',
  },
  {
    selector: "Literal[value=/^rgba?\\s*\\(/]",
    message:
      'Use theme tokens for rgba() values — see tokens.scrim.*, tokens.shadow.*, or alpha() against a palette color.',
  },
  {
    selector:
      "Literal[value=/(linear|radial)-gradient\\s*\\(.*#[0-9a-fA-F]/]",
    message:
      'Gradients with literal hex stops belong in tokens.gradient.* — reference them via useChoreoTokens instead.',
  },
];

module.exports = {
  root: true,
  overrides: [
    {
      files: ['packages/**/*.{ts,tsx}', 'plugins/**/*.{ts,tsx}'],
      excludedFiles: [
        // Tokens are the single source of truth; literals live here by design.
        'packages/design-system/src/theme/tokens.ts',
        // Factory translates tokens into MUI overrides; a few !important
        // template strings reference token vars inline and may trip the RegExp.
        'packages/design-system/src/theme/buildOpenChoreoTheme.ts',
        // Brand SVG icon with baked-in brand colors.
        'packages/design-system/src/icons/**',
        // Generated code must not be hand-edited.
        '**/dist/**',
        '**/dist-types/**',
        '**/generated/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      rules: {
        'no-restricted-syntax': ['error', ...colorLiteralRules],
      },
    },
  ],
};
