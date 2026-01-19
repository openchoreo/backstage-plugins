import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
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
  const [namespaces, setNamespaces] = useState<NamespaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.listNamespaces();
      setNamespaces(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch namespaces'),
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    namespaces,
    loading,
    error,
    refresh,
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
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const refresh = useCallback(async () => {
    if (!namespaceName) {
      setProjects([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await client.listProjects(namespaceName);
      setProjects(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch projects'),
      );
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    projects,
    loading,
    error,
    refresh,
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
  const [components, setComponents] = useState<ComponentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const refresh = useCallback(async () => {
    if (!namespaceName || !projectName) {
      setComponents([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await client.listComponents(namespaceName, projectName);
      setComponents(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch components'),
      );
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName, projectName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    components,
    loading,
    error,
    refresh,
  };
}
