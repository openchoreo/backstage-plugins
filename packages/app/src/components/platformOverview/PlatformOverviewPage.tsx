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
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import Popover from '@material-ui/core/Popover';
import MenuList from '@material-ui/core/MenuList';
import Checkbox from '@material-ui/core/Checkbox';
import Divider from '@material-ui/core/Divider';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import {
  PlatformOverviewGraphView,
  GraphKindFilter,
  buildDynamicView,
  APPLICATION_VIEW,
  useProjects,
  type EntityNode,
} from '@openchoreo/backstage-plugin-react';
import { useQueryParams } from '@openchoreo/backstage-plugin';

const useStyles = makeStyles(theme => ({
  content: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  namespaceSelector: {
    minWidth: 160,
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
}));

const DEFAULT_KINDS = APPLICATION_VIEW.kinds;

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

export function PlatformOverviewPage() {
  const classes = useStyles();
  const [params, setParams] = useQueryParams<{
    kinds: string;
    ns: string;
    excludedProjects: string | undefined;
  }>({
    kinds: {
      defaultValue: DEFAULT_KINDS.join(','),
    },
    ns: { defaultValue: 'default' },
    excludedProjects: { defaultValue: undefined },
  });
  const navigate = useNavigate();
  const catalogEntityRoute = useRouteRef(entityRouteRef);
  const namespaces = useNamespaces();
  const projects = useProjects(params.ns);
  const [projectAnchor, setProjectAnchor] = useState<HTMLButtonElement | null>(
    null,
  );

  const selectedKinds = useMemo(
    () =>
      typeof params.kinds === 'string'
        ? params.kinds.split(',').filter(Boolean)
        : DEFAULT_KINDS,
    [params.kinds],
  );

  // Clear excluded projects when namespace changes or system kind is deselected
  const currentNs = params.ns;
  const systemKindSelected = selectedKinds.includes('system');
  const prevNsRef = useRef(currentNs);
  const prevSystemKindRef = useRef(systemKindSelected);
  useEffect(() => {
    const nsChanged = currentNs !== prevNsRef.current;
    const systemDeselected = prevSystemKindRef.current && !systemKindSelected;
    prevNsRef.current = currentNs;
    prevSystemKindRef.current = systemKindSelected;

    if ((nsChanged || systemDeselected) && params.excludedProjects) {
      setParams({ excludedProjects: undefined }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNs, systemKindSelected]);

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
    () => projects.filter(p => !excludedSet.has(p)),
    [projects, excludedSet],
  );

  const handleProjectToggle = useCallback(
    (project: string) => {
      const next = new Set(excludedSet);
      if (next.has(project)) {
        next.delete(project);
      } else {
        // Don't allow excluding if it would leave 0 selected
        if (selectedProjects.length <= 1) return;
        next.add(project);
      }
      setParams({
        excludedProjects: next.size > 0 ? [...next].join(',') : undefined,
      });
    },
    [excludedSet, selectedProjects.length, setParams],
  );

  const showProjectFilter =
    selectedKinds.includes('system') && projects.length > 0;

  const currentView = useMemo(
    () => buildDynamicView(selectedKinds),
    [selectedKinds],
  );

  const handleKindsChange = useCallback(
    (kinds: string[]) => {
      setParams({ kinds: kinds.join(',') });
    },
    [setParams],
  );

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

  const projectButtonLabel = useMemo(() => {
    if (selectedProjects.length === projects.length) return 'Project: All';
    return `Project: ${selectedProjects.length} of ${projects.length}`;
  }, [selectedProjects.length, projects.length]);

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
            const isSelected = !excludedSet.has(p);
            const isLastSelected = isSelected && selectedProjects.length <= 1;
            return (
              <MenuItem
                key={p}
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
                <ListItemText primary={p} />
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
      <Header title="Platform Overview" subtitle={currentView.description} />
      <Content stretch noPadding className={classes.content}>
        <GraphKindFilter
          selectedKinds={selectedKinds}
          onKindsChange={handleKindsChange}
          leading={
            <FormControl
              variant="outlined"
              size="small"
              className={classes.namespaceSelector}
            >
              <InputLabel id="graph-namespace-label">Namespace</InputLabel>
              <Select
                labelId="graph-namespace-label"
                label="Namespace"
                value={params.ns}
                onChange={e => setParams({ ns: e.target.value as string })}
              >
                {namespaces.map(ns => (
                  <MenuItem key={ns} value={ns}>
                    {ns}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
          trailing={projectTrailing}
        />
        <PlatformOverviewGraphView
          view={currentView}
          namespace={params.ns}
          projects={showProjectFilter ? activeProjectFilter : undefined}
          allProjects={showProjectFilter ? projects : undefined}
          onNodeClick={handleNodeClick}
        />
      </Content>
    </Page>
  );
}
