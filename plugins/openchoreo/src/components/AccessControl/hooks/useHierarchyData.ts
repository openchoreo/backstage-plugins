import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  OrganizationSummary,
  ProjectSummary,
  ComponentSummary,
} from '../../../api/OpenChoreoClientApi';

// ============================================
// useOrganizations Hook
// ============================================

interface UseOrganizationsResult {
  organizations: OrganizationSummary[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useOrganizations(): UseOrganizationsResult {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.listOrganizations();
      setOrganizations(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch organizations'),
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    organizations,
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

export function useProjects(orgName: string | undefined): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const refresh = useCallback(async () => {
    if (!orgName) {
      setProjects([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await client.listProjects(orgName);
      setProjects(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch projects'),
      );
    } finally {
      setLoading(false);
    }
  }, [client, orgName]);

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
  orgName: string | undefined,
  projectName: string | undefined,
): UseComponentsResult {
  const [components, setComponents] = useState<ComponentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const refresh = useCallback(async () => {
    if (!orgName || !projectName) {
      setComponents([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await client.listComponents(orgName, projectName);
      setComponents(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch components'),
      );
    } finally {
      setLoading(false);
    }
  }, [client, orgName, projectName]);

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
