import { createContext, useContext, type ReactNode } from 'react';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';

export type ActionKind = 'promote' | 'deploy' | 'undeploy' | 'retain';

export interface ResourceEnvironmentsContextValue {
  environments: ResourceEnvironment[];
  loading: boolean;
  refetch: () => void | Promise<void>;

  selectedEnvName: string | null;
  setSelectedEnvName: (name: string | null) => void;

  pendingAction: { env: string; kind: ActionKind } | null;

  onPromote: (environment: string, releaseName: string) => void | Promise<void>;
  onDeploy: (environment: string, releaseName: string) => void | Promise<void>;
  onUndeployRequest: (environment: string) => void;
  onRetainPolicyChange: (
    environment: string,
    retainPolicy: 'Delete' | 'Retain',
  ) => void | Promise<void>;
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
