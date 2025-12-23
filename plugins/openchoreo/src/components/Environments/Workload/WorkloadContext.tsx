import {
  ReactNode,
  FC,
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from 'react';
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
  /** Whether any row is currently being edited (in edit buffer) */
  isEditing: boolean;
  /** Set editing state for a specific section */
  setEditingSection: (section: string, isEditing: boolean) => void;
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
  /** Callback when editing state changes */
  onEditingChange?: (isEditing: boolean) => void;
}> = ({
  builds,
  workloadSpec,
  setWorkloadSpec,
  children,
  isDeploying,
  initialWorkload = null,
  onEditingChange,
}) => {
  // Calculate changes between initial and current workload
  const changes = useWorkloadChanges(initialWorkload, workloadSpec);

  // Track which sections are currently being edited
  const [editingSections, setEditingSections] = useState<Set<string>>(
    new Set(),
  );

  const setEditingSection = useCallback(
    (section: string, editing: boolean) => {
      setEditingSections(prev => {
        const newSet = new Set(prev);
        if (editing) {
          newSet.add(section);
        } else {
          newSet.delete(section);
        }
        // Notify parent of editing state change
        const newIsEditing = newSet.size > 0;
        const wasEditing = prev.size > 0;
        if (onEditingChange && newIsEditing !== wasEditing) {
          onEditingChange(newIsEditing);
        }
        return newSet;
      });
    },
    [onEditingChange],
  );

  const isEditing = editingSections.size > 0;

  const value = useMemo(
    () => ({
      builds,
      workloadSpec,
      setWorkloadSpec,
      isDeploying,
      initialWorkload,
      changes,
      isEditing,
      setEditingSection,
    }),
    [
      builds,
      workloadSpec,
      setWorkloadSpec,
      isDeploying,
      initialWorkload,
      changes,
      isEditing,
      setEditingSection,
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
