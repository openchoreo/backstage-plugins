/**
 * Feature flags for OpenChoreo functionality.
 * Each feature can be enabled/disabled via app-config.yaml.
 *
 * Configuration path: `openchoreo.features.*`
 *
 * @example
 * ```yaml
 * openchoreo:
 *   features:
 *     workflows:
 *       enabled: false
 *     observability:
 *       enabled: true
 *     auth:
 *       enabled: true
 * ```
 */
export interface OpenChoreoFeatures {
  /** Build plane / Workflows feature */
  workflows: { enabled: boolean };
  /** Observability plane features (Metrics, Traces, Logs) */
  observability: { enabled: boolean };
  /** Authentication feature (when disabled, uses guest mode) */
  auth: { enabled: boolean };
}

/**
 * Feature names that can be toggled.
 */
export type FeatureName = 'workflows' | 'observability' | 'auth';
