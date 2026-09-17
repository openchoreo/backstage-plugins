import { FC } from 'react';
import { Box, makeStyles } from '@material-ui/core';
import { MultiSelectFilter } from '@openchoreo/backstage-design-system';
import {
  componentValue,
  parseComponentValue,
  parseProjectValue,
  projectValue,
  useResolvedScopeSelection,
} from './useCostScopeOptions';
import type { CostScopeSelection } from './types';

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

/**
 * The three cascading multi-select scope filters (Namespace → Project →
 * Component) shown below the page header. A filter is enabled once its parent
 * holds a single item, so only one tier is narrowed at a time. A full selection
 * is stored as an empty one: "all" is the absence of a filter.
 * E.g. The component filter is disabled until a single project is selected
 */
export const CostInsightsScopeFilters: FC<CostInsightsScopeFiltersProps> = ({
  selection,
  onChange,
}) => {
  const classes = useStyles();
  const { resolved, namespaceOptions, projectOptions, componentOptions } =
    useResolvedScopeSelection(selection);

  const selectedNamespaces = new Set(resolved.namespaces);
  const selectedProjects = new Set(
    selection.projects.length
      ? selection.projects.map(projectValue)
      : projectOptions.map(o => o.value),
  );
  const selectedComponents = new Set(
    selection.components.length
      ? selection.components.map(componentValue)
      : componentOptions.map(o => o.value),
  );

  const onNamespacesChange = (next: Set<string>) => {
    onChange({
      namespaces: next.size === namespaceOptions.length ? [] : [...next],
      projects: [],
      components: [],
    });
  };

  const onProjectsChange = (next: Set<string>) => {
    onChange({
      ...selection,
      projects:
        next.size === projectOptions.length
          ? []
          : [...next].map(parseProjectValue),
      components: [],
    });
  };

  const onComponentsChange = (next: Set<string>) => {
    onChange({
      ...selection,
      components:
        next.size === componentOptions.length
          ? []
          : [...next].map(parseComponentValue),
    });
  };

  return (
    <Box className={classes.root}>
      <MultiSelectFilter
        label="Namespaces"
        groups={[{ label: 'Namespaces', options: namespaceOptions }]}
        allValues={namespaceOptions.map(o => o.value)}
        selected={selectedNamespaces}
        onChange={onNamespacesChange}
        hideClear
        showOnlyAction
        nameSoleOption
      />
      <MultiSelectFilter
        label="Projects"
        groups={[{ label: 'Projects', options: projectOptions }]}
        allValues={projectOptions.map(o => o.value)}
        selected={selectedProjects}
        onChange={onProjectsChange}
        disabled={resolved.namespaces.length !== 1}
        disabledHint="Select a single namespace in order to filter by projects"
        hideClear
        showOnlyAction
        nameSoleOption
      />
      <MultiSelectFilter
        label="Components"
        groups={[{ label: 'Components', options: componentOptions }]}
        allValues={componentOptions.map(o => o.value)}
        selected={selectedComponents}
        onChange={onComponentsChange}
        disabled={resolved.projects.length !== 1}
        disabledHint="Select a single project in order to filter by components"
        hideClear
        showOnlyAction
        nameSoleOption
      />
    </Box>
  );
};
