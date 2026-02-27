/**
 * Graph utilities for custom entity node rendering in the catalog graph.
 * Provides kind-based coloring and label prefixes for better entity differentiation.
 */

/**
 * Entity kind to color mapping using theme palette colors.
 * These colors are used to visually distinguish different entity types in the graph.
 */
export const ENTITY_KIND_COLORS: Record<string, string> = {
  // Standard Backstage kinds
  system: '#6c7fd8', // primary.main - Blue for projects/systems
  component: '#64748b', // slate - Slate for components
  api: '#6c7fd8', // primary.main - Blue for APIs
  group: '#6b7280', // secondary.main - Gray for groups
  user: '#6b7280', // secondary.main - Gray for users
  resource: '#6b7280', // secondary.main - Gray for resources
  domain: '#6c7fd8', // primary.main - Blue for domains

  // OpenChoreo custom kinds
  environment: '#10b981', // success.main - Green for environments
  dataplane: '#6b7280', // secondary.main - Gray for dataplanes
  deploymentpipeline: '#f59e0b', // warning.main - Orange for pipelines
  observabilityplane: '#8b5cf6', // Purple for observability planes
  buildplane: '#3b82f6', // Blue for build planes
  componenttype: '#f59e0b', // Orange for component types
  traittype: '#10b981', // Green for trait types
  clustercomponenttype: '#f59e0b', // Orange for cluster component types (same as componenttype)
  clustertraittype: '#10b981', // Green for cluster trait types (same as traittype)
  clusterdataplane: '#6b7280', // secondary.main - Gray for cluster dataplanes (same as dataplane)
  clusterobservabilityplane: '#8b5cf6', // Purple for cluster observability planes (same as observabilityplane)
  clusterbuildplane: '#3b82f6', // Blue for cluster build planes (same as buildplane)
  workflow: '#8b5cf6', // Purple for workflows
  componentworkflow: '#3b82f6', // Blue for component workflows
};

/**
 * Default color for unknown entity kinds.
 */
export const DEFAULT_NODE_COLOR = '#6b7280'; // secondary.main

/** Primary-tinted edge color for graph connections. */
export const EDGE_COLOR = '#6c7fd8'; // matches primary.main

/**
 * Tint fills for node backgrounds keyed by accent color.
 * Each accent maps to a light-mode and dark-mode background tint.
 */
export const ENTITY_KIND_TINTS: Record<
  string,
  { light: string; dark: string }
> = {
  '#6c7fd8': { light: '#eef0fa', dark: '#1a1d2e' },
  '#64748b': { light: '#f1f5f9', dark: '#1e2330' },
  '#6b7280': { light: '#f3f4f6', dark: '#1f2128' },
  '#10b981': { light: '#ecfdf5', dark: '#162a22' },
  '#f59e0b': { light: '#fffbeb', dark: '#2a2010' },
  '#8b5cf6': { light: '#f3f0ff', dark: '#1e1a2e' },
  '#3b82f6': { light: '#eff6ff', dark: '#151c2e' },
};

const DEFAULT_TINT = { light: '#f3f4f6', dark: '#1f2128' };

/**
 * Returns the tint fill color for a node background based on its accent color
 * and the current color scheme.
 */
export function getNodeTintFill(accentColor: string, isDark: boolean): string {
  const tint = ENTITY_KIND_TINTS[accentColor] ?? DEFAULT_TINT;
  return isDark ? tint.dark : tint.light;
}

/**
 * Kind label prefixes for entity display names.
 * Provides context for both standard Backstage kinds and custom OpenChoreo kinds.
 */
export const KIND_LABEL_PREFIXES: Record<string, string> = {
  // Standard Backstage kinds
  domain: 'NS',
  system: 'Project',
  component: 'Comp',

  // OpenChoreo custom kinds
  dataplane: 'DP',
  environment: 'Env',
  deploymentpipeline: 'Pipeline',
  observabilityplane: 'Obs',
  buildplane: 'BP',
  componenttype: 'CT',
  traittype: 'Trait',
  clustercomponenttype: 'CCT',
  clustertraittype: 'CTrait',
  clusterdataplane: 'CDP',
  clusterobservabilityplane: 'CObs',
  clusterbuildplane: 'CBP',
  workflow: 'WF',
  componentworkflow: 'CWF',
};

/**
 * Gets the display color for an entity based on its kind.
 *
 * @param kind - The entity kind (e.g., 'Component', 'Environment')
 * @returns The hex color string for the entity
 */
export function getNodeColor(kind: string | undefined): string {
  if (!kind) return DEFAULT_NODE_COLOR;
  return ENTITY_KIND_COLORS[kind.toLowerCase()] ?? DEFAULT_NODE_COLOR;
}

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
  buildplane: 'Build Plane',
  componenttype: 'Component Type',
  traittype: 'Trait Type',
  clustercomponenttype: 'Cluster Component Type',
  clustertraittype: 'Cluster Trait Type',
  clusterdataplane: 'Cluster Data Plane',
  clusterobservabilityplane: 'Cluster Obs Plane',
  clusterbuildplane: 'Cluster Build Plane',
  workflow: 'Workflow',
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
 *
 * @param kind - The entity kind
 * @param name - The entity name/title
 * @returns The display label with optional prefix
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
