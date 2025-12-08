import { createContext, useContext, ReactNode } from 'react';
import type { Environment } from './hooks/useEnvironmentData';
import type { PendingAction } from './types';

interface EnvironmentsContextValue {
  /** All environments loaded from the API */
  environments: Environment[];
  /** Environments with stale data handling */
  displayEnvironments: Environment[];
  /** Whether environments are currently loading */
  loading: boolean;
  /** Refetch environments data */
  refetch: () => void;
  /** The lowest environment (first in deployment pipeline) */
  lowestEnvironment: string;
  /** Whether workload editor is supported for this component */
  isWorkloadEditorSupported: boolean;
  /** Auto deploy setting */
  autoDeploy: boolean | undefined;
  /** Whether auto deploy is being updated */
  autoDeployUpdating: boolean;
  /** Handler for auto deploy toggle */
  onAutoDeployChange: (enabled: boolean) => Promise<void>;
  /** Handler for completing a pending action (deploy/promote) */
  onPendingActionComplete: (action: PendingAction) => Promise<void>;
}

const EnvironmentsContext = createContext<EnvironmentsContextValue | null>(
  null,
);

interface EnvironmentsProviderProps {
  children: ReactNode;
  value: EnvironmentsContextValue;
}

export const EnvironmentsProvider = ({
  children,
  value,
}: EnvironmentsProviderProps) => {
  return (
    <EnvironmentsContext.Provider value={value}>
      {children}
    </EnvironmentsContext.Provider>
  );
};

export function useEnvironmentsContext() {
  const context = useContext(EnvironmentsContext);
  if (!context) {
    throw new Error(
      'useEnvironmentsContext must be used within an EnvironmentsProvider',
    );
  }
  return context;
}
