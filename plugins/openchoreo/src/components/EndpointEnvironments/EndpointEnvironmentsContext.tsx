import { createContext, useContext, type ReactNode } from 'react';
import type { EndpointEnvironment } from '../../api/OpenChoreoClientApi';
import type { EndpointReleaseDriftInfo } from './endpointEnvironmentUtils';

export type EndpointActionKind = 'promote' | 'undeploy';

export interface EndpointEnvironmentsContextValue {
  environments: EndpointEnvironment[];
  refetch: () => void | Promise<void>;
  /** The action in flight, keyed by the target environment's K8s name. */
  pendingAction: { env: string; kind: EndpointActionKind } | null;
  /** Pipeline drift per environment display name. */
  driftByEnv: Map<string, EndpointReleaseDriftInfo>;
  /** Pins `environment` (a K8s env name) to `releaseName`. */
  onPromote: (environment: string, releaseName: string) => void | Promise<void>;
  onUndeployRequest: (environment: string) => void;
  onViewReleaseManifest: (env: EndpointEnvironment) => void;
}

const EndpointEnvironmentsContext =
  createContext<EndpointEnvironmentsContextValue | null>(null);

export const EndpointEnvironmentsProvider = ({
  value,
  children,
}: {
  value: EndpointEnvironmentsContextValue;
  children: ReactNode;
}) => (
  <EndpointEnvironmentsContext.Provider value={value}>
    {children}
  </EndpointEnvironmentsContext.Provider>
);

export function useEndpointEnvironmentsContext(): EndpointEnvironmentsContextValue {
  const ctx = useContext(EndpointEnvironmentsContext);
  if (!ctx) {
    throw new Error(
      'useEndpointEnvironmentsContext must be called inside <EndpointEnvironmentsProvider>',
    );
  }
  return ctx;
}
