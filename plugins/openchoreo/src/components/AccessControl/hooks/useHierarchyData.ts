import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  NamespaceSummary,
  ProjectSummary,
  ComponentSummary,
} from '../../../api/OpenChoreoClientApi';

// ============================================
// useNamespaces Hook
// ============================================

interface UseNamespacesResult {
  namespaces: NamespaceSummary[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useNamespaces(): UseNamespacesResult {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, error, refetch } = useOpenChoreoQuery(
    ['hierarchy', 'namespaces'],
    () => client.listNamespaces(),
  );

  return {
    namespaces: data ?? [],
    loading,
    error,
    refresh: async () => {
      await refetch();
    },
  };
}

// ============================================
// useProjects Hook
// ============================================

interface UseProjectsResult {
  projects: ProjectSummary[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjects(
  namespaceName: string | undefined,
): UseProjectsResult {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, error, refetch } = useOpenChoreoQuery(
    ['hierarchy', 'projects', namespaceName ?? null],
    () => client.listProjects(namespaceName as string),
    { enabled: !!namespaceName },
  );

  return {
    projects: data ?? [],
    loading,
    error,
    refresh: async () => {
      await refetch();
    },
  };
}

// ============================================
// useComponents Hook
// ============================================

interface UseComponentsResult {
  components: ComponentSummary[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useComponents(
  namespaceName: string | undefined,
  projectName: string | undefined,
): UseComponentsResult {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, error, refetch } = useOpenChoreoQuery(
    ['hierarchy', 'components', namespaceName ?? null, projectName ?? null],
    () => client.listComponents(namespaceName as string, projectName as string),
    { enabled: !!namespaceName && !!projectName },
  );

  return {
    components: data ?? [],
    loading,
    error,
    refresh: async () => {
      await refetch();
    },
  };
}
