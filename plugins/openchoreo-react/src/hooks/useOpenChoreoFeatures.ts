import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { useMemo } from 'react';
import type { OpenChoreoFeatures } from '@openchoreo/backstage-plugin-common';

/**
 * Default feature configuration when no config is provided.
 * All features are enabled by default EXCEPT `assistant`, which is opt-in
 * because it requires the `assistant-agent` service + LLM API key.
 */
const defaultFeatures: OpenChoreoFeatures = {
  workflows: { enabled: true },
  observability: { enabled: true },
  auth: { enabled: true },
  authz: { enabled: true },
  cilium: { enabled: false },
  assistant: { enabled: false },
};

/**
 * Hook to read OpenChoreo feature flags from app configuration.
 *
 * Features are read from `openchoreo.features.*` in app-config.yaml.
 * All features default to enabled if not specified.
 *
 * @example
 * ```tsx
 * const features = useOpenChoreoFeatures();
 * if (features.workflows.enabled) {
 *   // render workflows UI
 * }
 * ```
 */
export function useOpenChoreoFeatures(): OpenChoreoFeatures {
  const configApi = useApi(configApiRef);

  return useMemo(() => {
    try {
      const featuresConfig = configApi.getOptionalConfig('openchoreo.features');

      if (!featuresConfig) {
        return defaultFeatures;
      }

      return {
        workflows: {
          enabled:
            featuresConfig.getOptionalBoolean('workflows.enabled') ?? true,
        },
        observability: {
          enabled:
            featuresConfig.getOptionalBoolean('observability.enabled') ?? true,
        },
        auth: {
          enabled: featuresConfig.getOptionalBoolean('auth.enabled') ?? true,
        },
        authz: {
          enabled: featuresConfig.getOptionalBoolean('authz.enabled') ?? true,
        },
        cilium: {
          enabled: featuresConfig.getOptionalBoolean('cilium.enabled') ?? false,
        },
        assistant: {
          enabled:
            featuresConfig.getOptionalBoolean('assistant.enabled') ?? false,
        },
      };
    } catch {
      // If config reading fails, use defaults to avoid breaking the app
      return defaultFeatures;
    }
  }, [configApi]);
}

/**
 * Helper hook to check if the Workflows feature is enabled.
 */
export function useWorkflowsEnabled(): boolean {
  const features = useOpenChoreoFeatures();
  return features.workflows.enabled;
}

/**
 * Helper hook to check if the Observability feature is enabled.
 */
export function useObservabilityEnabled(): boolean {
  const features = useOpenChoreoFeatures();
  return features.observability.enabled;
}

/**
 * Helper hook to check if Authentication is enabled.
 */
export function useAuthEnabled(): boolean {
  const features = useOpenChoreoFeatures();
  return features.auth.enabled;
}

/**
 * Helper hook to check if Authorization (Access Control) is enabled.
 */
export function useAuthzEnabled(): boolean {
  const features = useOpenChoreoFeatures();
  return features.authz.enabled;
}

/**
 * Helper hook to check if Cilium (HTTP metrics) is enabled.
 */
export function useCiliumEnabled(): boolean {
  const features = useOpenChoreoFeatures();
  return features.cilium.enabled;
}

/*
 * Helper hook to check if the OpenChoreo Assistant is enabled.
 * Defaults to false (opt-in).
 */
export function useAssistantEnabled(): boolean {
  const features = useOpenChoreoFeatures();
  return features.assistant.enabled;
}
