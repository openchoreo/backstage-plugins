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
  component: '#6c7fd8', // primary.main - Blue for components
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
};

/**
 * Default color for unknown entity kinds.
 */
export const DEFAULT_NODE_COLOR = '#6b7280'; // secondary.main

/**
 * Kind label prefixes for entity display names.
 * Only custom OpenChoreo kinds get prefixes to provide context.
 */
export const KIND_LABEL_PREFIXES: Record<string, string> = {
  dataplane: 'DP',
  environment: 'Env',
  deploymentpipeline: 'Pipeline',
  observabilityplane: 'Obs',
  buildplane: 'BP',
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
