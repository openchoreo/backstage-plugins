import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Header, Content } from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { makeStyles } from '@material-ui/core/styles';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import Popover from '@material-ui/core/Popover';
import MenuList from '@material-ui/core/MenuList';
import Checkbox from '@material-ui/core/Checkbox';
import Divider from '@material-ui/core/Divider';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import {
  PlatformOverviewGraphView,
  GraphKindFilter,
  buildDynamicView,
  getEffectiveKinds,
  APPLICATION_VIEW,
  CLUSTER_NAMESPACE,
  useProjects,
  type ProjectEntry,
  type EntityNode,
} from '@openchoreo/backstage-plugin-react';
import { useQueryParams } from '@openchoreo/backstage-plugin';

const useStyles = makeStyles(theme => ({
  content: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  triggerButton: {
    textTransform: 'none',
    fontSize: '0.8rem',
    fontWeight: 500,
    padding: theme.spacing(0.5, 1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
    '&:hover': {
      borderColor: theme.palette.text.secondary,
    },
  },
  popoverPaper: {
    minWidth: 220,
  },
  menuItem: {
    minHeight: 36,
    paddingTop: 2,
    paddingBottom: 2,
  },
  checkbox: {
    padding: 4,
  },
  subheader: {
    lineHeight: '28px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
  },
}));

const DEFAULT_KINDS = APPLICATION_VIEW.kinds;
const DEFAULT_SCOPE = `${CLUSTER_NAMESPACE},default`;

function useNamespaces() {
  const catalogApi = useApi(catalogApiRef);
  const [namespaces, setNamespaces] = useState<string[]>(['default']);

  const fetchNamespaces = useCallback(async () => {
    try {
      const response = await catalogApi.getEntities({
        filter: { kind: 'Domain' },
        fields: ['metadata.name'],
      });
      const names = response.items.map(e => e.metadata.name).sort();
      if (names.length > 0) {
        setNamespaces(names);
      }
    } catch {
      // Namespace fetch is non-critical; fall back to initial ['default']
    }
  }, [catalogApi]);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  return namespaces;
}

/** Unique key for a project entry, used for query param encoding. */
function projectKey(p: ProjectEntry): string {
  return `${p.namespace}/${p.name}`;
}

export function PlatformOverviewPage() {
  const classes = useStyles();
  const [params, setParams] = useQueryParams<{
    kinds: string;
    scope: string;
    excludedProjects: string | undefined;
  }>({
    kinds: { defaultValue: DEFAULT_KINDS.join(',') },
    scope: { defaultValue: DEFAULT_SCOPE },
    excludedProjects: { defaultValue: undefined },
  });
  const navigate = useNavigate();
  const catalogEntityRoute = useRouteRef(entityRouteRef);
  const availableNamespaces = useNamespaces();

  // --- Scope state ---
  const selectedScopes = useMemo(
    () =>
      typeof params.scope === 'string'
        ? params.scope.split(',').filter(Boolean)
        : DEFAULT_SCOPE.split(','),
    [params.scope],
  );
  const clusterSelected = selectedScopes.includes(CLUSTER_NAMESPACE);
  const selectedNamespaces = useMemo(
    () => selectedScopes.filter(s => s !== CLUSTER_NAMESPACE),
    [selectedScopes],
  );

  // Namespaces for project fetching (excludes cluster namespace)
  const projectNamespaces = useMemo(
    () => (selectedNamespaces.length > 0 ? selectedNamespaces : undefined),
    [selectedNamespaces],
  );
  const projects = useProjects(projectNamespaces);

  const [scopeAnchor, setScopeAnchor] = useState<HTMLButtonElement | null>(
    null,
  );
  const [projectAnchor, setProjectAnchor] = useState<HTMLButtonElement | null>(
    null,
  );

  // --- Kinds ---
  const selectedKinds = useMemo(
    () =>
      typeof params.kinds === 'string'
        ? params.kinds.split(',').filter(Boolean)
        : DEFAULT_KINDS,
    [params.kinds],
  );

  // Build effective view with auto-included cluster kinds
  const effectiveView = useMemo(() => {
    const effectiveKinds = getEffectiveKinds(selectedKinds, clusterSelected);
    return buildDynamicView(effectiveKinds);
  }, [selectedKinds, clusterSelected]);

  // The user-facing view (for description/subtitle) uses the raw selected kinds
  const displayView = useMemo(
    () => buildDynamicView(selectedKinds),
    [selectedKinds],
  );

  // --- Clear excluded projects when scope changes or system kind is deselected ---
  const currentScope = params.scope;
  const systemKindSelected = selectedKinds.includes('system');
  const prevScopeRef = useRef(currentScope);
  const prevSystemKindRef = useRef(systemKindSelected);
  useEffect(() => {
    const scopeChanged = currentScope !== prevScopeRef.current;
    const systemDeselected = prevSystemKindRef.current && !systemKindSelected;
    prevScopeRef.current = currentScope;
    prevSystemKindRef.current = systemKindSelected;

    if ((scopeChanged || systemDeselected) && params.excludedProjects) {
      setParams({ excludedProjects: undefined }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScope, systemKindSelected]);

  // --- Project filter ---
  const excludedSet = useMemo(
    () =>
      new Set(
        params.excludedProjects
          ? params.excludedProjects.split(',').filter(Boolean)
          : [],
      ),
    [params.excludedProjects],
  );

  const selectedProjects = useMemo(
    () => projects.filter(p => !excludedSet.has(projectKey(p))),
    [projects, excludedSet],
  );

  const handleProjectToggle = useCallback(
    (project: ProjectEntry) => {
      const key = projectKey(project);
      const next = new Set(excludedSet);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (selectedProjects.length <= 1) return;
        next.add(key);
      }
      setParams({
        excludedProjects: next.size > 0 ? [...next].join(',') : undefined,
      });
    },
    [excludedSet, selectedProjects.length, setParams],
  );

  const showProjectFilter =
    selectedKinds.includes('system') && projects.length > 0;

  // --- Scope selector ---
  const handleScopeToggle = useCallback(
    (item: string) => {
      const current = new Set(selectedScopes);
      if (current.has(item)) {
        if (current.size <= 1) return; // prevent empty scope
        current.delete(item);
      } else {
        current.add(item);
      }
      setParams({ scope: [...current].join(',') });
    },
    [selectedScopes, setParams],
  );

  const scopeButtonLabel = useMemo(() => {
    const parts: string[] = [];
    if (clusterSelected) parts.push('Cluster');
    if (selectedNamespaces.length === 1) {
      parts.push(selectedNamespaces[0]);
    } else if (selectedNamespaces.length > 1) {
      parts.push(`${selectedNamespaces.length} namespaces`);
    }
    if (parts.length === 0) return 'Scope: None';
    return `Scope: ${parts.join(' + ')}`;
  }, [clusterSelected, selectedNamespaces]);

  // --- Kind filter ---
  const handleKindsChange = useCallback(
    (kinds: string[]) => {
      setParams({ kinds: kinds.join(',') });
    },
    [setParams],
  );

  // --- Node click ---
  const handleNodeClick = useCallback(
    (node: EntityNode, _event: MouseEvent<unknown>) => {
      const route = catalogEntityRoute({
        kind: node.kind ?? 'component',
        namespace: node.namespace ?? 'default',
        name: node.name,
      });
      navigate(route);
    },
    [catalogEntityRoute, navigate],
  );

  // --- Project filter labels ---
  const multiNamespace = selectedNamespaces.length > 1;
  const projectButtonLabel = useMemo(() => {
    if (selectedProjects.length === projects.length) return 'Project: All';
    return `Project: ${selectedProjects.length} of ${projects.length}`;
  }, [selectedProjects.length, projects.length]);

  const projectDisplayName = useCallback(
    (p: ProjectEntry) => (multiNamespace ? `${p.namespace}/${p.name}` : p.name),
    [multiNamespace],
  );

  // --- Scope selector popover ---
  const scopeLeading = (
    <>
      <Button
        className={classes.triggerButton}
        endIcon={<ArrowDropDownIcon />}
        onClick={e => setScopeAnchor(e.currentTarget)}
      >
        {scopeButtonLabel}
      </Button>
      <Popover
        open={Boolean(scopeAnchor)}
        anchorEl={scopeAnchor}
        onClose={() => setScopeAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ className: classes.popoverPaper }}
      >
        <MenuList dense>
          <MenuItem
            className={classes.menuItem}
            disabled={clusterSelected && selectedScopes.length <= 1}
            onClick={() => handleScopeToggle(CLUSTER_NAMESPACE)}
          >
            <ListItemIcon>
              <Checkbox
                className={classes.checkbox}
                checked={clusterSelected}
                disabled={clusterSelected && selectedScopes.length <= 1}
                color="primary"
                size="small"
                disableRipple
              />
            </ListItemIcon>
            <ListItemText primary="Cluster" />
          </MenuItem>
        </MenuList>
        <Divider />
        <ListSubheader className={classes.subheader} disableSticky>
          Namespaces
        </ListSubheader>
        <MenuList dense>
          {availableNamespaces.map(ns => {
            const isSelected = selectedNamespaces.includes(ns);
            const isLastItem = isSelected && selectedScopes.length <= 1;
            return (
              <MenuItem
                key={ns}
                className={classes.menuItem}
                disabled={isLastItem}
                onClick={() => handleScopeToggle(ns)}
              >
                <ListItemIcon>
                  <Checkbox
                    className={classes.checkbox}
                    checked={isSelected}
                    disabled={isLastItem}
                    color="primary"
                    size="small"
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText primary={ns} />
              </MenuItem>
            );
          })}
        </MenuList>
      </Popover>
    </>
  );

  // --- Project filter popover ---
  const projectTrailing = showProjectFilter ? (
    <>
      <Button
        className={classes.triggerButton}
        endIcon={<ArrowDropDownIcon />}
        onClick={e => setProjectAnchor(e.currentTarget)}
      >
        {projectButtonLabel}
      </Button>
      <Popover
        open={Boolean(projectAnchor)}
        anchorEl={projectAnchor}
        onClose={() => setProjectAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ className: classes.popoverPaper }}
      >
        <MenuList dense>
          <MenuItem
            className={classes.menuItem}
            disabled={selectedProjects.length === projects.length}
            onClick={() => {
              setParams({ excludedProjects: undefined });
              setProjectAnchor(null);
            }}
          >
            <ListItemIcon>
              <Checkbox
                className={classes.checkbox}
                checked={selectedProjects.length === projects.length}
                indeterminate={
                  selectedProjects.length > 0 &&
                  selectedProjects.length < projects.length
                }
                color="primary"
                size="small"
                disableRipple
              />
            </ListItemIcon>
            <ListItemText primary="All" />
          </MenuItem>
          <Divider />
          {projects.map(p => {
            const key = projectKey(p);
            const isSelected = !excludedSet.has(key);
            const isLastSelected = isSelected && selectedProjects.length <= 1;
            return (
              <MenuItem
                key={key}
                className={classes.menuItem}
                disabled={isLastSelected}
                onClick={() => handleProjectToggle(p)}
              >
                <ListItemIcon>
                  <Checkbox
                    className={classes.checkbox}
                    checked={isSelected}
                    disabled={isLastSelected}
                    color="primary"
                    size="small"
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText primary={projectDisplayName(p)} />
              </MenuItem>
            );
          })}
        </MenuList>
      </Popover>
    </>
  ) : undefined;

  // Only pass projects filter when not all are selected
  const activeProjectFilter = useMemo(
    () =>
      selectedProjects.length < projects.length ? selectedProjects : undefined,
    [selectedProjects, projects.length],
  );

  return (
    <Page themeId="tool">
      <Header title="Platform Overview" subtitle={displayView.description} />
      <Content stretch noPadding className={classes.content}>
        <GraphKindFilter
          selectedKinds={selectedKinds}
          onKindsChange={handleKindsChange}
          clusterScopeActive={clusterSelected}
          leading={scopeLeading}
          trailing={projectTrailing}
        />
        <PlatformOverviewGraphView
          view={effectiveView}
          namespaces={selectedScopes}
          projects={showProjectFilter ? activeProjectFilter : undefined}
          allProjects={showProjectFilter ? projects : undefined}
          onNodeClick={handleNodeClick}
        />
      </Content>
    </Page>
  );
}
