import { useMemo } from 'react';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

/**
 * A kind scored apart from the entity it belongs to and listed under it,
 * from `techInsights.scorecards.variants`, for example a component's release
 * lines. The parent's tier covers only itself, its "main" variant.
 */
export interface VariantConfig {
  kind: string;
  parentKind: string;
  /** What the parent is called beside its variants. */
  mainLabel: string;
}

const lower = (kind: string) => kind.toLocaleLowerCase('en-US');

export function isKind(kind: string, other: string): boolean {
  return lower(kind) === lower(other);
}

/**
 * `kinds` plus the variant kind when they include its parent kind, so a
 * parent's variants are listed with it whether or not a check names them.
 */
export function withVariantKind(
  kinds: string[],
  variants: VariantConfig | undefined,
): string[] {
  if (!variants) return kinds;
  const hasParent = kinds.some(kind => isKind(kind, variants.parentKind));
  const hasVariant = kinds.some(kind => isKind(kind, variants.kind));
  return hasParent && !hasVariant ? [...kinds, variants.kind] : kinds;
}

export function useVariantConfig(): VariantConfig | undefined {
  const config = useApi(configApiRef);
  return useMemo(() => {
    const variants = config.getOptionalConfig(
      'techInsights.scorecards.variants',
    );
    if (!variants) return undefined;
    return {
      kind: variants.getString('kind'),
      parentKind: variants.getString('parentKind'),
      mainLabel: variants.getOptionalString('mainLabel') ?? 'main',
    };
  }, [config]);
}
