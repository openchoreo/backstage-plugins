import { createContext, useContext, type ReactNode } from 'react';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';
import type { ResourceReleaseDriftInfo } from './computeResourceReleaseDrift';

export type ActionKind = 'promote' | 'undeploy' | 'retain';

export interface ResourceEnvironmentsContextValue {
  environments: ResourceEnvironment[];
  loading: boolean;
  refetch: () => void | Promise<void>;

  selectedEnvName: string | null;
  setSelectedEnvName: (name: string | null) => void;

  pendingAction: { env: string; kind: ActionKind } | null;

  /** Pipeline drift per env name (Component-style upstream comparison). */
  driftByEnv: Map<string, ResourceReleaseDriftInfo>;

  onPromote: (environment: string, releaseName: string) => void | Promise<void>;
  onUndeployRequest: (environment: string) => void;
  onRetainPolicyChange: (
    environment: string,
    retainPolicy: 'Delete' | 'Retain',
  ) => void | Promise<void>;

  /**
   * Open the View release manifest modal for the given env. Both the
   * env card 3-dot menu and the detail panel Release row invoke this
   * so there's a single dialog instance lifted up in the list view.
   */
  onViewReleaseManifest: (env: ResourceEnvironment) => void;
}

const ResourceEnvironmentsContext =
  createContext<ResourceEnvironmentsContextValue | null>(null);

interface ProviderProps {
  value: ResourceEnvironmentsContextValue;
  children: ReactNode;
}

export const ResourceEnvironmentsProvider = ({
  value,
  children,
}: ProviderProps) => (
  <ResourceEnvironmentsContext.Provider value={value}>
    {children}
  </ResourceEnvironmentsContext.Provider>
);

export function useResourceEnvironmentsContext(): ResourceEnvironmentsContextValue {
  const ctx = useContext(ResourceEnvironmentsContext);
  if (!ctx) {
    throw new Error(
      'useResourceEnvironmentsContext must be called inside <ResourceEnvironmentsProvider>',
    );
  }
  return ctx;
}
