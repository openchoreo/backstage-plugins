import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import type { MultiSelectOption } from '@openchoreo/backstage-design-system';
import type {
  CostComponentRef,
  CostProjectRef,
  CostScopeSelection,
} from './types';

const byLabel = (a: MultiSelectOption, b: MultiSelectOption) =>
  a.label.localeCompare(b.label);

const titleOf = (entity: { metadata: Entity['metadata'] }) =>
  entity.metadata.title || entity.metadata.name;

export const projectValue = (p: CostProjectRef) => `${p.namespace}/${p.name}`;
export const parseProjectValue = (value: string): CostProjectRef => {
  const [namespace, name] = value.split('/');
  return { namespace, name };
};

export const componentValue = (c: CostComponentRef) =>
  `${c.namespace}/${c.project}/${c.name}`;
export const parseComponentValue = (value: string): CostComponentRef => {
  const [namespace, project, name] = value.split('/');
  return { namespace, project, name };
};

export function useCostNamespaceOptions(): {
  options: MultiSelectOption[];
  loading: boolean;
} {
  const catalogApi = useApi(catalogApiRef);
  const { data, loading } = useOpenChoreoQuery<MultiSelectOption[]>(
    ['cost-insights-filter-namespaces'],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: { kind: 'Domain' },
        fields: ['metadata.name', 'metadata.title'],
      });
      return items
        .map(e => ({ value: e.metadata.name, label: titleOf(e) }))
        .sort(byLabel);
    },
  );
  return { options: data ?? [], loading };
}

export function useCostProjectOptions(namespace?: string): {
  options: MultiSelectOption[];
  loading: boolean;
} {
  const catalogApi = useApi(catalogApiRef);
  const { data, loading } = useOpenChoreoQuery<MultiSelectOption[]>(
    ['cost-insights-filter-projects', namespace ?? ''],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: { kind: 'System', 'metadata.namespace': namespace! },
        fields: ['metadata.name', 'metadata.title'],
      });
      return items
        .map(e => ({
          value: projectValue({ namespace: namespace!, name: e.metadata.name }),
          label: titleOf(e),
        }))
        .sort(byLabel);
    },
    { enabled: Boolean(namespace) },
  );
  return { options: data ?? [], loading };
}

export function useCostComponentOptions(project?: CostProjectRef): {
  options: MultiSelectOption[];
  loading: boolean;
} {
  const catalogApi = useApi(catalogApiRef);
  const { data, loading } = useOpenChoreoQuery<MultiSelectOption[]>(
    ['cost-insights-filter-components', project ? projectValue(project) : ''],
    async () => {
      const { namespace, name } = project!;
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'Component',
          [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]: namespace,
          [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]: name,
        },
        fields: ['metadata.name', 'metadata.title', 'metadata.annotations'],
      });
      return items
        .filter(e => {
          const ann = e.metadata.annotations ?? {};
          return (
            ann[CHOREO_ANNOTATIONS.NAMESPACE] === namespace &&
            ann[CHOREO_ANNOTATIONS.PROJECT] === name
          );
        })
        .map(e => ({
          value: componentValue({
            namespace,
            project: name,
            name: e.metadata.name,
          }),
          label: titleOf(e),
        }))
        .sort(byLabel);
    },
    { enabled: Boolean(project) },
  );
  return { options: data ?? [], loading };
}

export interface ResolvedScopeSelection {
  resolved: CostScopeSelection;
  namespaceOptions: MultiSelectOption[];
  projectOptions: MultiSelectOption[];
  componentOptions: MultiSelectOption[];
  loading: boolean;
}

/**
 * Resolves the URL selection against the catalog and loads the options each
 * dropdown offers. A single namespace unlocks its projects, a single project its
 * components.
 *
 * An empty tier means all of them: namespaces resolve to the full list (the
 * default scope), while deeper tiers stay empty because "every project of this
 * namespace" is already the namespace scope. The exception is a tier holding a
 * single option, which resolves to it so a lone child item drills down.
 */
/** A list holding one option resolves to it; anything wider stays "all". */
const soleOption = <T>(
  options: MultiSelectOption[],
  parse: (value: string) => T,
): T[] => (options.length === 1 ? [parse(options[0].value)] : []);

export function useResolvedScopeSelection(
  selection: CostScopeSelection,
): ResolvedScopeSelection {
  const { options: namespaceOptions, loading: namespacesLoading } =
    useCostNamespaceOptions();

  const namespaces = selection.namespaces.length
    ? selection.namespaces
    : namespaceOptions.map(o => o.value);

  const { options: projectOptions, loading: projectsLoading } =
    useCostProjectOptions(namespaces.length === 1 ? namespaces[0] : undefined);
  const projects = selection.projects.length
    ? selection.projects
    : soleOption(projectOptions, parseProjectValue);

  const { options: componentOptions, loading: componentsLoading } =
    useCostComponentOptions(projects.length === 1 ? projects[0] : undefined);
  const components = selection.components.length
    ? selection.components
    : soleOption(componentOptions, parseComponentValue);

  return {
    resolved: { namespaces, projects, components },
    namespaceOptions,
    projectOptions,
    componentOptions,
    // Any tier still loading means the scope can still change.
    loading: namespacesLoading || projectsLoading || componentsLoading,
  };
}
