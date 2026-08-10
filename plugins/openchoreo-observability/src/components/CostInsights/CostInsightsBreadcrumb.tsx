import { FC, useRef, useState } from 'react';
import {
  Link,
  Menu,
  MenuItem,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { useGetComponentsByProject } from '../../hooks/useGetComponentsByProject';
import type { CostScope } from './types';

// Rendered inside the gradient header bar, so text/border derive from
// `theme.page.fontColor` to stay legible on the purple background.
const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.25),
    marginTop: theme.spacing(0.5),
  },
  segment: {
    display: 'inline-flex',
    alignItems: 'center',
    color: theme.page.fontColor,
    border: `1px solid ${theme.page.fontColor}33`,
    borderRadius: 6,
    backgroundColor: `${theme.page.fontColor}0D`,
    padding: theme.spacing(0.125, 0.5, 0.125, 0.75),
    '&:hover': {
      backgroundColor: `${theme.page.fontColor}1A`,
    },
  },
  kind: {
    color: theme.page.fontColor,
    opacity: 0.75,
    fontWeight: 500,
    marginRight: theme.spacing(0.5),
    fontSize: theme.typography.body2.fontSize,
    textTransform: 'lowercase',
  },
  // The name is a hyperlink to that scope level: underline on hover, navigate
  // on click. `component="button"` renders a real button, so reset its chrome.
  value: {
    color: theme.page.fontColor,
    fontWeight: 700,
    fontSize: theme.typography.body2.fontSize,
    fontFamily: 'inherit',
    background: 'transparent',
    border: 0,
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'none',
    '&:hover': {
      color: theme.page.fontColor,
      textDecoration: 'underline',
    },
  },
  caretButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 0,
    padding: 0,
    marginLeft: theme.spacing(0.25),
    cursor: 'pointer',
    color: theme.page.fontColor,
  },
  caret: {
    color: theme.page.fontColor,
    opacity: 0.85,
    display: 'block',
  },
}));

interface Option {
  name: string;
  label: string;
}

interface ScopeSegmentProps {
  kind: string;
  value: string;
  options: Option[];
  loading?: boolean;
  /** Switch to a sibling at this level (via the caret dropdown). */
  onSelect: (name: string | undefined) => void;
  /** Navigate to this scope level (clicking the name). */
  onNavigate: () => void;
}

const ScopeSegment: FC<ScopeSegmentProps> = ({
  kind,
  value,
  options,
  loading,
  onSelect,
  onNavigate,
}) => {
  const classes = useStyles();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <span className={classes.segment}>
        <Typography component="span" className={classes.kind}>
          {`${kind}s /`}
        </Typography>
        <Link
          component="button"
          type="button"
          className={classes.value}
          onClick={onNavigate}
        >
          {value}
        </Link>
        <button
          ref={anchorRef}
          type="button"
          className={classes.caretButton}
          onClick={() => setOpen(true)}
          aria-label={`Switch ${kind}`}
        >
          <ArrowDropDownIcon className={classes.caret} fontSize="small" />
        </button>
      </span>
      <Menu
        anchorEl={anchorRef.current}
        open={open}
        onClose={() => setOpen(false)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {loading && <MenuItem disabled>Loading…</MenuItem>}
        {!loading && options.length === 0 && (
          <MenuItem disabled>No {kind}s found</MenuItem>
        )}
        {options.map(opt => (
          <MenuItem
            key={opt.name}
            selected={opt.name === value}
            onClick={() => {
              onSelect(opt.name);
              setOpen(false);
            }}
          >
            {opt.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export interface CostInsightsBreadcrumbProps {
  scope: CostScope;
  onScopeChange: (next: CostScope) => void;
}

export const CostInsightsBreadcrumb: FC<CostInsightsBreadcrumbProps> = ({
  scope,
  onScopeChange,
}) => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);

  // Options carry the raw entity name (used for navigation + cost-API calls) and
  // the catalog `metadata.title` as the display label, so the breadcrumb shows
  // "GCP Microservice Demo" rather than "gcp-microservices-demo".
  const toOptions = (
    items: Array<{ metadata: Entity['metadata'] }>,
  ): Option[] =>
    items
      .map(e => ({
        name: e.metadata.name,
        label: e.metadata.title || e.metadata.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

  const { data: namespaces = [], loading: nsLoading } = useOpenChoreoQuery<
    Option[]
  >(['cost-insights-namespaces'], async () => {
    const { items } = await catalogApi.getEntities({
      filter: { kind: 'Domain' },
      fields: ['metadata.name', 'metadata.title'],
    });
    return toOptions(items);
  });

  const { data: projects = [], loading: projLoading } = useOpenChoreoQuery<
    Option[]
  >(
    ['cost-insights-projects', scope.namespace ?? ''],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: { kind: 'System', 'metadata.namespace': scope.namespace! },
        fields: ['metadata.name', 'metadata.title'],
      });
      return toOptions(items);
    },
    { enabled: Boolean(scope.namespace) },
  );

  // Reuse the shared project-components hook (kind=Component + namespace/project
  // annotation filter). It keys off a project entity, so synthesise one from the
  // current scope; a missing namespace/project leaves the hook's guard disabled.
  const projectEntity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: scope.project ?? '',
      annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: scope.namespace ?? '' },
    },
  };
  const { components: projectComponents, loading: compLoading } =
    useGetComponentsByProject(projectEntity);
  const components: Option[] = projectComponents
    .map(c => ({ name: c.name, label: c.displayName || c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Display the title for the selected name (falls back to the name until the
  // options load, or when the entity has no title).
  const labelFor = (options: Option[], name?: string): string =>
    (name && options.find(o => o.name === name)?.label) || name || '';

  return (
    <div className={classes.root}>
      <ScopeSegment
        kind="namespace"
        value={labelFor(namespaces, scope.namespace) || 'Select namespace'}
        options={namespaces}
        loading={nsLoading}
        onSelect={name => onScopeChange({ namespace: name })}
        onNavigate={() => onScopeChange({ namespace: scope.namespace })}
      />

      {/* Only show a level once it is actually selected; an absent deeper level
          means "all" (aggregated). Clicking a name navigates to that level,
          dropping any deeper selection. */}
      {scope.project && (
        <ScopeSegment
          kind="project"
          value={labelFor(projects, scope.project)}
          options={projects}
          loading={projLoading}
          onSelect={name =>
            onScopeChange({ namespace: scope.namespace, project: name })
          }
          onNavigate={() =>
            onScopeChange({
              namespace: scope.namespace,
              project: scope.project,
            })
          }
        />
      )}

      {scope.project && scope.component && (
        <ScopeSegment
          kind="component"
          value={labelFor(components, scope.component)}
          options={components}
          loading={compLoading}
          onSelect={name =>
            onScopeChange({
              namespace: scope.namespace,
              project: scope.project,
              component: name,
            })
          }
          onNavigate={() =>
            onScopeChange({
              namespace: scope.namespace,
              project: scope.project,
              component: scope.component,
            })
          }
        />
      )}
    </div>
  );
};
