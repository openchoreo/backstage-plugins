import { createContext, useContext, type ReactNode } from 'react';
import type { ProjectEnvironment } from '../../api/OpenChoreoClientApi';

export type ActionKind = 'promote';

export interface ProjectEnvironmentsContextValue {
  environments: ProjectEnvironment[];
  loading: boolean;
  refetch: () => void | Promise<void>;

  selectedEnvName: string | null;
  setSelectedEnvName: (name: string | null) => void;

  pendingAction: { env: string; kind: ActionKind } | null;

  /**
   * Copy the source env's pinned ProjectRelease forward to the target
   * env's binding (the promote flow). `environment` is the target env's
   * K8s resource name; `releaseName` is the release to pin.
   */
  onPromote: (environment: string, releaseName: string) => void | Promise<void>;
}

const ProjectEnvironmentsContext =
  createContext<ProjectEnvironmentsContextValue | null>(null);

interface ProviderProps {
  value: ProjectEnvironmentsContextValue;
  children: ReactNode;
}

export const ProjectEnvironmentsProvider = ({
  value,
  children,
}: ProviderProps) => (
  <ProjectEnvironmentsContext.Provider value={value}>
    {children}
  </ProjectEnvironmentsContext.Provider>
);

export function useProjectEnvironmentsContext(): ProjectEnvironmentsContextValue {
  const ctx = useContext(ProjectEnvironmentsContext);
  if (!ctx) {
    throw new Error(
      'useProjectEnvironmentsContext must be called inside <ProjectEnvironmentsProvider>',
    );
  }
  return ctx;
}
