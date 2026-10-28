import { createContext, useContext, FC, ReactNode } from 'react';
import { MenuItem, TextField } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import {
  useGetComponentsByProject,
  type Component,
} from '../../hooks/useGetComponentsByProject';

/**
 * A namespace → project → component selection. Each level is optional; an absent
 * deeper level means "all" (aggregated) at the level above.
 */
export interface ScopeSelection {
  namespace?: string;
  project?: string;
  component?: string;
}

interface Option {
  name: string;
  label: string;
}

const ALL = '';

interface ScopeFilterContextValue {
  scope: ScopeSelection;
  onScopeChange: (next: ScopeSelection) => void;
  namespaces: Option[];
  projects: Option[];
  components: Option[];
}

const ScopeFilterContext = createContext<ScopeFilterContextValue | null>(null);

const useScopeFilter = (control: string): ScopeFilterContextValue => {
  const value = useContext(ScopeFilterContext);
  if (!value) {
    throw new Error(
      `<${control}> must be rendered inside <ScopeFilterProvider>`,
    );
  }
  return value;
};

export interface ScopeFilterProviderProps {
  scope: ScopeSelection;
  onScopeChange: (next: ScopeSelection) => void;
  /**
   * Prefix for the catalog query cache keys. Pages showing the same
   * namespace/project lists share a prefix to share the cached lookups.
   */
  queryKeyPrefix?: string;
  children: ReactNode;
}

/**
 * Holds the scope selection and the cascading option lists behind it, so the
 * filter controls below can be placed in any order the page needs.
 *
 * The controls are separate components rather than one block because a page's
 * own filters may belong among them -- environment, on Delivery Insights, is
 * not part of the namespace → project → component hierarchy but is still a
 * filter on which data is shown, so it reads better beside these than after the
 * chart controls. Each level's options depend on the one above, so the queries
 * live here and the controls stay presentational.
 *
 * Renders no markup of its own: the controls remain direct children of whatever
 * lays the filter bar out.
 */
export const ScopeFilterProvider: FC<ScopeFilterProviderProps> = ({
  scope,
  onScopeChange,
  queryKeyPrefix = 'insights-scope',
  children,
}) => {
  const catalogApi = useApi(catalogApiRef);

  // Options carry the entity name (used for navigation and API calls) and the
  // catalog title as the label, so a filter reads "GCP Microservice Demo"
  // rather than "gcp-microservices-demo".
  const toOptions = (
    items: Array<{ metadata: Entity['metadata'] }>,
  ): Option[] =>
    items
      .map(e => ({
        name: e.metadata.name,
        label: e.metadata.title || e.metadata.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

  const { data: namespaces = [] } = useOpenChoreoQuery<Option[]>(
    [`${queryKeyPrefix}-namespaces`],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: { kind: 'Domain' },
        fields: ['metadata.name', 'metadata.title'],
      });
      return toOptions(items);
    },
  );

  const { data: projects = [] } = useOpenChoreoQuery<Option[]>(
    [`${queryKeyPrefix}-projects`, scope.namespace ?? ''],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: { kind: 'System', 'metadata.namespace': scope.namespace! },
        fields: ['metadata.name', 'metadata.title'],
      });
      return toOptions(items);
    },
    { enabled: Boolean(scope.namespace) },
  );

  // The shared hook keys off a project entity, so synthesise one from the
  // current scope; a missing namespace or project leaves its guard disabled.
  const projectEntity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: scope.project ?? '',
      annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: scope.namespace ?? '' },
    },
  };
  const { components: projectComponents } =
    useGetComponentsByProject(projectEntity);
  const components: Option[] = projectComponents
    .map((c: Component) => ({ name: c.name, label: c.displayName || c.name }))
    .sort((a: Option, b: Option) => a.label.localeCompare(b.label));

  return (
    <ScopeFilterContext.Provider
      value={{ scope, onScopeChange, namespaces, projects, components }}
    >
      {children}
    </ScopeFilterContext.Provider>
  );
};

export const NamespaceFilter: FC = () => {
  const { scope, onScopeChange, namespaces } =
    useScopeFilter('NamespaceFilter');
  return (
    <TextField
      select
      size="small"
      variant="outlined"
      label="Namespace"
      value={scope.namespace ?? ALL}
      // A different namespace invalidates any project and component under it.
      onChange={event => onScopeChange({ namespace: event.target.value })}
      style={{ minWidth: 160 }}
    >
      {namespaces.map(option => (
        <MenuItem key={option.name} value={option.name}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

/**
 * Project and component each offer an "All" option, because the absence of a
 * selection is itself a scope -- no project means the namespace as a whole -- so
 * the control has to be able to return to it, not only descend.
 */
export const ProjectFilter: FC = () => {
  const { scope, onScopeChange, projects } = useScopeFilter('ProjectFilter');
  return (
    <TextField
      select
      size="small"
      variant="outlined"
      label="Project"
      value={scope.project ?? ALL}
      disabled={!scope.namespace}
      SelectProps={{ displayEmpty: true }}
      InputLabelProps={{ shrink: true }}
      onChange={event =>
        onScopeChange({
          namespace: scope.namespace,
          project: event.target.value || undefined,
        })
      }
      style={{ minWidth: 160 }}
    >
      <MenuItem value={ALL}>All projects</MenuItem>
      {projects.map(option => (
        <MenuItem key={option.name} value={option.name}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

export const ComponentFilter: FC = () => {
  const { scope, onScopeChange, components } =
    useScopeFilter('ComponentFilter');
  return (
    <TextField
      select
      size="small"
      variant="outlined"
      label="Component"
      value={scope.component ?? ALL}
      disabled={!scope.project}
      SelectProps={{ displayEmpty: true }}
      InputLabelProps={{ shrink: true }}
      onChange={event =>
        onScopeChange({
          namespace: scope.namespace,
          project: scope.project,
          component: event.target.value || undefined,
        })
      }
      style={{ minWidth: 160 }}
    >
      <MenuItem value={ALL}>All components</MenuItem>
      {components.map(option => (
        <MenuItem key={option.name} value={option.name}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};
