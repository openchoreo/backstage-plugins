import { FC, useMemo } from 'react';
import { Box, makeStyles } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import {
  MultiSelectFilter,
  type MultiSelectOption,
} from '@openchoreo/backstage-design-system';
import type {
  CostComponentRef,
  CostProjectRef,
  CostScopeSelection,
} from './types';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },
}));

export interface CostInsightsScopeFiltersProps {
  selection: CostScopeSelection;
  onChange: (next: CostScopeSelection) => void;
}

const byLabel = (a: MultiSelectOption, b: MultiSelectOption) =>
  a.label.localeCompare(b.label);

const titleOf = (entity: { metadata: Entity['metadata'] }) =>
  entity.metadata.title || entity.metadata.name;

/** `ns/name` value for a project option, so its namespace survives selection. */
const projectValue = (p: CostProjectRef) => `${p.namespace}/${p.name}`;
const parseProjectValue = (value: string): CostProjectRef => {
  const [namespace, name] = value.split('/');
  return { namespace, name };
};

/** `ns/project/name` value for a component option. */
const componentValue = (c: CostComponentRef) =>
  `${c.namespace}/${c.project}/${c.name}`;
const parseComponentValue = (value: string): CostComponentRef => {
  const [namespace, project, name] = value.split('/');
  return { namespace, project, name };
};

/**
 * The three cascading multi-select scope filters (Namespace → Project →
 * Component) shown below the page header. Deselecting a parent prunes the now
 * orphaned child selections. Child dropdowns disable until a parent is picked.
 */
export const CostInsightsScopeFilters: FC<CostInsightsScopeFiltersProps> = ({
  selection,
  onChange,
}) => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);

  // Namespaces are catalog Domains.
  const { data: namespaceOptions = [] } = useOpenChoreoQuery<
    MultiSelectOption[]
  >(['cost-insights-filter-namespaces'], async () => {
    const { items } = await catalogApi.getEntities({
      filter: { kind: 'Domain' },
      fields: ['metadata.name', 'metadata.title'],
    });
    return items
      .map(e => ({ value: e.metadata.name, label: titleOf(e) }))
      .sort(byLabel);
  });

  // Projects are Systems within the selected namespaces.
  const { data: projectOptions = [] } = useOpenChoreoQuery<MultiSelectOption[]>(
    [
      'cost-insights-filter-projects',
      [...selection.namespaces].sort().join(','),
    ],
    async () => {
      const results = await Promise.all(
        selection.namespaces.map(async namespace => {
          const { items } = await catalogApi.getEntities({
            filter: { kind: 'System', 'metadata.namespace': namespace },
            fields: ['metadata.name', 'metadata.title'],
          });
          return items.map(e => ({
            value: projectValue({ namespace, name: e.metadata.name }),
            label: titleOf(e),
          }));
        }),
      );
      return results.flat().sort(byLabel);
    },
    { enabled: selection.namespaces.length > 0 },
  );

  // Components belong to the selected projects (namespace + project annotations).
  const { data: componentOptions = [] } = useOpenChoreoQuery<
    MultiSelectOption[]
  >(
    [
      'cost-insights-filter-components',
      selection.projects.map(projectValue).sort().join(','),
    ],
    async () => {
      const results = await Promise.all(
        selection.projects.map(async ({ namespace, name: project }) => {
          const { items } = await catalogApi.getEntities({
            filter: {
              kind: 'Component',
              [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]:
                namespace,
              [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]: project,
            },
            fields: ['metadata.name', 'metadata.title', 'metadata.annotations'],
          });
          return items
            .filter(e => {
              const ann = e.metadata.annotations ?? {};
              return (
                ann[CHOREO_ANNOTATIONS.NAMESPACE] === namespace &&
                ann[CHOREO_ANNOTATIONS.PROJECT] === project
              );
            })
            .map(e => ({
              value: componentValue({
                namespace,
                project,
                name: e.metadata.name,
              }),
              label: titleOf(e),
            }));
        }),
      );
      return results.flat().sort(byLabel);
    },
    { enabled: selection.projects.length > 0 },
  );

  const selectedNamespaces = useMemo(
    () => new Set(selection.namespaces),
    [selection.namespaces],
  );
  const selectedProjects = useMemo(
    () => new Set(selection.projects.map(projectValue)),
    [selection.projects],
  );
  const selectedComponents = useMemo(
    () => new Set(selection.components.map(componentValue)),
    [selection.components],
  );

  const onNamespacesChange = (next: Set<string>) => {
    onChange({
      namespaces: [...next],
      // Drop projects/components whose namespace is no longer selected.
      projects: selection.projects.filter(p => next.has(p.namespace)),
      components: selection.components.filter(c => next.has(c.namespace)),
    });
  };

  const onProjectsChange = (next: Set<string>) => {
    onChange({
      ...selection,
      projects: [...next].map(parseProjectValue),
      // Drop components whose project is no longer selected.
      components: selection.components.filter(c =>
        next.has(projectValue({ namespace: c.namespace, name: c.project })),
      ),
    });
  };

  const onComponentsChange = (next: Set<string>) => {
    onChange({ ...selection, components: [...next].map(parseComponentValue) });
  };

  return (
    <Box className={classes.root}>
      <MultiSelectFilter
        label="Namespaces"
        groups={[{ label: 'Namespaces', options: namespaceOptions }]}
        allValues={namespaceOptions.map(o => o.value)}
        selected={selectedNamespaces}
        onChange={onNamespacesChange}
      />
      <MultiSelectFilter
        label="Projects"
        groups={[{ label: 'Projects', options: projectOptions }]}
        allValues={projectOptions.map(o => o.value)}
        selected={selectedProjects}
        onChange={onProjectsChange}
      />
      <MultiSelectFilter
        label="Components"
        groups={[{ label: 'Components', options: componentOptions }]}
        allValues={componentOptions.map(o => o.value)}
        selected={selectedComponents}
        onChange={onComponentsChange}
      />
    </Box>
  );
};
