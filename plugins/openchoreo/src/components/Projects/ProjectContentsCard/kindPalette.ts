import type { ThemeTokens } from '@openchoreo/backstage-design-system';

export interface KindPalette {
  /** Foreground color — text, dot, and border. */
  fg: string;
  /** Tinted background color. */
  bg: string;
}

const KIND_LABELS: Record<string, string> = {
  component: 'Component',
  resource: 'Resource',
};

export function getKindLabel(kind: string): string {
  return KIND_LABELS[kind.toLowerCase()] ?? kind;
}

/**
 * Resolves a kind's chip colors from the shared `entityKind` token palette —
 * the single source of truth also used by the catalog/relations graphs (see
 * `graphUtils.getEntityKindPalette`). Reading from it here keeps the table's
 * Kind chips in sync with the graph colors. Adjust colors per kind in
 * `tokens.ts`, not here.
 */
export function getKindPalette(kind: string, tokens: ThemeTokens): KindPalette {
  const palette =
    tokens.entityKind[kind.toLowerCase()] ?? tokens.entityKindDefault;
  return { fg: palette.accent, bg: palette.tint };
}
