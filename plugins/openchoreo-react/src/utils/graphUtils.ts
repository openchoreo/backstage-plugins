/**
 * Graph utilities for custom entity node rendering in the catalog graph.
 *
 * All colors come from `ThemeTokens` — this module no longer holds any
 * hardcoded colors. Adding a new theme or new entity kind is a change to
 * `packages/design-system/src/theme/tokens.ts`, not this file.
 */
import { alpha } from '@material-ui/core/styles';
import type {
  ThemeTokens,
  EntityKindPalette,
} from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/**
 * Looks up the accent + tint palette for an entity kind against the active
 * token set. Falls back to the token's default entry for unknown kinds.
 */
export function getEntityKindPalette(
  kind: string | undefined,
  tokens: ThemeTokens,
): EntityKindPalette {
  if (!kind) return tokens.entityKindDefault;
  return tokens.entityKind[kind.toLowerCase()] ?? tokens.entityKindDefault;
}

/**
 * Accent color for an entity kind.
 */
export function getNodeColor(
  kind: string | undefined,
  tokens: ThemeTokens,
): string {
  return getEntityKindPalette(kind, tokens).accent;
}

/**
 * Surface tint used as the node background in the graph.
 */
export function getNodeTintFill(
  kind: string | undefined,
  tokens: ThemeTokens,
): string {
  return getEntityKindPalette(kind, tokens).tint;
}

/**
 * Default node color for non-entity contexts (e.g. fallback chips).
 */
export function getDefaultNodeColor(tokens: ThemeTokens): string {
  return tokens.entityKindDefault.accent;
}

/**
 * Edge color for graph connections.
 */
export function getEdgeColor(tokens: ThemeTokens): string {
  return tokens.graph.edge;
}

/**
 * Warning color used for nodes marked for deletion.
 */
export function getDeletionWarningColor(tokens: ThemeTokens): string {
  return tokens.deletionWarning;
}

/**
 * Helper to apply an alpha fraction to a token-sourced hex color. Prefer
 * this over string concatenation (`${color}B3`) so components don't need
 * to know about hex-alpha encoding.
 */
export function withAlpha(color: string, fraction: number): string {
  return alpha(color, fraction);
}

/**
 * Kind label prefixes for entity display names.
 */
export const KIND_LABEL_PREFIXES: Record<string, string> = {
  domain: 'NS',
  system: 'Project',
  component: 'Comp',
  dataplane: 'DP',
  environment: 'Env',
  deploymentpipeline: 'Pipeline',
  observabilityplane: 'Obs',
  workflowplane: 'WP',
  componenttype: 'CT',
  traittype: 'Trait',
  clustercomponenttype: 'CCT',
  clustertraittype: 'CTrait',
  clusterdataplane: 'CDP',
  clusterobservabilityplane: 'CObs',
  clusterworkflowplane: 'CWP',
  workflow: 'WF',
  clusterworkflow: 'CWF',
  componentworkflow: 'CompWF',
};

/**
 * Full kind labels for two-row node display.
 */
export const KIND_FULL_LABELS: Record<string, string> = {
  domain: 'Namespace',
  system: 'Project',
  component: 'Component',
  dataplane: 'Data Plane',
  environment: 'Environment',
  deploymentpipeline: 'Pipeline',
  observabilityplane: 'Obs Plane',
  workflowplane: 'Workflow Plane',
  componenttype: 'Component Type',
  traittype: 'Trait Type',
  clustercomponenttype: 'Cluster Component Type',
  clustertraittype: 'Cluster Trait Type',
  clusterdataplane: 'Cluster Data Plane',
  clusterobservabilityplane: 'Cluster Obs Plane',
  clusterworkflowplane: 'Cluster Workflow Plane',
  workflow: 'Workflow',
  clusterworkflow: 'Cluster Workflow',
  componentworkflow: 'Component Workflow',
};

/**
 * Gets the full kind label for an entity kind.
 */
export function getNodeKindLabel(kind: string | undefined): string | undefined {
  if (!kind) return undefined;
  return KIND_FULL_LABELS[kind.toLowerCase()];
}

/**
 * Gets the display label for an entity, adding kind prefix for custom OpenChoreo kinds.
 */
export function getNodeDisplayLabel(
  kind: string | undefined,
  name: string,
): string {
  if (!kind) return name;

  const prefix = KIND_LABEL_PREFIXES[kind.toLowerCase()];
  if (prefix) {
    return `${prefix}: ${name}`;
  }

  return name;
}

/**
 * Checks whether an entity is marked for deletion by looking for
 * the deletion-timestamp annotation.
 */
export function isNodeMarkedForDeletion(entity: {
  metadata: { annotations?: Record<string, string> };
}): boolean {
  return !!entity.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP];
}
