import { createContext, useContext, ReactNode } from 'react';
import type { Environment } from './hooks/useEnvironmentData';
import type { PendingAction } from './types';

/**
 * Canvas selection target. Lives on the context so selection survives
 * navigation between the deploy list view and intermediate pages
 * (workload-config, overrides, release-details). `null` = nothing
 * selected.
 */
export type Selection =
  | { kind: 'env'; name: string }
  | { kind: 'setup' }
  | null;

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
  /** Handler for completing a pending action (deploy/promote) */
  onPendingActionComplete: (action: PendingAction) => Promise<void>;
  /** Whether the user has permission to view environments */
  canViewEnvironments: boolean;
  /** Whether the environment read permission check is still loading */
  environmentReadPermissionLoading: boolean;
  /** Whether the user has permission to view release bindings */
  canViewBindings: boolean;
  /** Whether the release binding permission check is still loading */
  bindingsPermissionLoading: boolean;
  /** Currently selected canvas tile (env or setup). Null = nothing selected. */
  selection: Selection;
  /** Setter for the canvas selection. */
  setSelection: (next: Selection) => void;
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
