// Guardrail: colors must flow through theme tokens, never literals.
// Defined in `packages/design-system/src/theme/tokens.ts`. If you need a
// color that isn't yet a token, add it there — don't inline hex or rgba.
const colorLiteralRules = [
  {
    selector:
      'Literal[value=/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?(?!\\w)/]',
    message:
      'Use theme tokens (useChoreoTokens / theme.palette / lightTokens / darkTokens) instead of hardcoded hex colors. Add a token in packages/design-system/src/theme/tokens.ts if needed.',
  },
  {
    selector: 'Literal[value=/\\brgba?\\s*\\(/]',
    message:
      'Use theme tokens for rgba() values — see tokens.scrim.*, tokens.shadow.*, or alpha() against a palette color.',
  },
  {
    selector: 'Literal[value=/(linear|radial)-gradient\\s*\\(.*#[0-9a-fA-F]/]',
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
    {
      // a11y regression net for frontend code. Phase A baseline scan showed
      // 0 instances of these rules because MUI v4 hides the raw HTML —
      // promoting them from warn to error is free today and catches future
      // raw-HTML use. Scoped to .tsx so the backend packages (which don't
      // ship the jsx-a11y plugin in their lint config) aren't affected.
      files: ['packages/**/*.tsx', 'plugins/**/*.tsx'],
      excludedFiles: [
        '**/dist/**',
        '**/dist-types/**',
        '**/generated/**',
        '**/*.test.tsx',
      ],
      rules: {
        'jsx-a11y/alt-text': 'error',
        'jsx-a11y/anchor-has-content': 'error',
        'jsx-a11y/aria-props': 'error',
        'jsx-a11y/aria-role': 'error',
        'jsx-a11y/aria-unsupported-elements': 'error',
        'jsx-a11y/click-events-have-key-events': 'error',
        'jsx-a11y/heading-has-content': 'error',
        'jsx-a11y/iframe-has-title': 'error',
        'jsx-a11y/img-redundant-alt': 'error',
        'jsx-a11y/label-has-associated-control': 'error',
        'jsx-a11y/no-noninteractive-element-interactions': 'error',
        'jsx-a11y/no-redundant-roles': 'error',
        'jsx-a11y/no-static-element-interactions': 'error',
        'jsx-a11y/role-has-required-aria-props': 'error',
        'jsx-a11y/role-supports-aria-props': 'error',
      },
    },
  ],
};
