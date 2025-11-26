import { ReactNode, FC, createContext, useContext } from 'react';
import {
  ModelsBuild,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';
import { SecretReference } from '../../../api/secretReferences';

interface WorkloadContextType {
  builds: ModelsBuild[];
  workloadSpec: ModelsWorkload | null;
  setWorkloadSpec: (spec: ModelsWorkload | null) => void;
  isDeploying: boolean;
  secretReferences: SecretReference[];
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
  secretReferences: SecretReference[];
}> = ({ builds, workloadSpec, setWorkloadSpec, children, isDeploying, secretReferences }) => {
  return (
    <WorkloadContext.Provider
      value={{ builds, workloadSpec, setWorkloadSpec, isDeploying, secretReferences }}
    >
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

export const useSecretReferences = () => {
  const { secretReferences } = useWorkloadContext();
  return { secretReferences };
};
