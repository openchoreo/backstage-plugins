import { ReactNode, FC, createContext, useContext, useMemo } from 'react';
import {
  ModelsBuild,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';
import {
  useWorkloadChanges,
  type WorkloadChanges,
} from './hooks/useWorkloadChanges';

interface WorkloadContextType {
  builds: ModelsBuild[];
  workloadSpec: ModelsWorkload | null;
  setWorkloadSpec: (spec: ModelsWorkload | null) => void;
  isDeploying: boolean;
  /** Initial workload data for change comparison */
  initialWorkload: ModelsWorkload | null;
  /** Detected changes between initial and current workload */
  changes: WorkloadChanges;
}

const WorkloadContext = createContext<WorkloadContextType | undefined>(
  undefined,
);

export const WorkloadProvider: FC<{
  builds: ModelsBuild[];
  workloadSpec: ModelsWorkload | null;
  setWorkloadSpec: (spec: ModelsWorkload | null) => void;
  children: ReactNode;
  isDeploying: boolean;
  /** Initial workload data for change comparison */
  initialWorkload?: ModelsWorkload | null;
}> = ({
  builds,
  workloadSpec,
  setWorkloadSpec,
  children,
  isDeploying,
  initialWorkload = null,
}) => {
  // Calculate changes between initial and current workload
  const changes = useWorkloadChanges(initialWorkload, workloadSpec);

  const value = useMemo(
    () => ({
      builds,
      workloadSpec,
      setWorkloadSpec,
      isDeploying,
      initialWorkload,
      changes,
    }),
    [
      builds,
      workloadSpec,
      setWorkloadSpec,
      isDeploying,
      initialWorkload,
      changes,
    ],
  );

  return (
    <WorkloadContext.Provider value={value}>
      {children}
    </WorkloadContext.Provider>
  );
};

export const useWorkloadContext = (): WorkloadContextType => {
  const context = useContext(WorkloadContext);
  if (context === undefined) {
    throw new Error(
      'useWorkloadContext must be used within a WorkloadProvider',
    );
  }
  return context;
};

export const useIsDeploying = () => {
  const { isDeploying } = useWorkloadContext();
  return isDeploying;
};

// Keep backwards compatibility
export const useBuilds = () => {
  const { builds } = useWorkloadContext();
  return { builds };
};

/**
 * Hook to get workload changes from context
 */
export const useWorkloadChangesContext = (): WorkloadChanges => {
  const { changes } = useWorkloadContext();
  return changes;
};
