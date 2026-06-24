import { useEffect, useState, type FC } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { parseEntityRef, type Entity } from '@backstage/catalog-model';
import { ResourcePodTerminalViewer } from '../Environments/ReleaseDataRenderer/ResourceTreeView/ResourcePodTerminalViewer';
import type { ExecContext } from '../Environments/ReleaseDataRenderer/ResourceTreeView/treeTypes';

const useStyles = makeStyles(theme => ({
  // Fixed viewport overlay so the terminal uses the entire window, covering the
  // app sidebar/header. Kept below MUI modal/popover z-indexes so the container
  // picker dropdown still renders above it.
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: theme.zIndex.drawer + 50,
    backgroundColor: theme.palette.background.default,
    display: 'flex',
    flexDirection: 'column',
  },
}));

interface ParsedParams {
  execContext: ExecContext | null;
  /** Synthetic entity rebuilt from entityRef, for the exec permission hook. */
  entity: Entity | null;
  pod?: string;
  containers: string[];
  initialContainer?: string;
  component: string;
}

/** Read the exec context from the URL query string once (non-reactive). */
function readParams(): ParsedParams {
  const p = new URLSearchParams(window.location.search);
  const ns = p.get('ns') ?? '';
  const project = p.get('project') ?? '';
  const component = p.get('component') ?? '';
  const env = p.get('env') ?? '';
  const entityRef = p.get('entityRef') ?? '';
  const empty: ParsedParams = {
    execContext: null,
    entity: null,
    containers: [],
    component,
  };

  if (!ns || !project || !component || !env || !entityRef) {
    return empty;
  }

  // The standalone window renders outside the component entity page, so the exec
  // permission hook (which calls useEntity) has no context. Rebuild a minimal
  // entity from the ref so the same per-component / per-env ABAC check runs here;
  // the backend re-enforces it on /exec/init regardless.
  let entity: Entity;
  try {
    const parsed = parseEntityRef(entityRef);
    entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: parsed.kind,
      metadata: { name: parsed.name, namespace: parsed.namespace },
    };
  } catch {
    return empty;
  }

  return {
    execContext: {
      namespaceName: ns,
      projectName: project,
      componentName: component,
      environmentName: env,
      environmentDisplayName: p.get('envLabel') || env,
      entityRef,
    },
    entity,
    pod: p.get('pod') ?? undefined,
    containers: (p.get('containers') ?? '').split(',').filter(Boolean),
    initialContainer: p.get('container') ?? undefined,
    component,
  };
}

/**
 * Full-window exec terminal opened in a separate browser tab from the resource
 * drawer's "open in new tab" button. Renders as a fixed viewport overlay and
 * reuses {@link ResourcePodTerminalViewer}, auto-connecting from URL params in
 * the same Backstage app (same login/session) as the originating tab.
 *
 * The params (ns, project, component, env, envLabel, entityRef, pod?,
 * containers?, container?) are snapshotted on mount and then stripped from the
 * address bar so the exec context isn't left in the URL or browser history.
 * (A manual reload after stripping won't reconnect — relaunch from the drawer.)
 */
export const ExecTerminalWindowPage: FC = () => {
  const classes = useStyles();
  const [params] = useState(readParams);

  useEffect(() => {
    if (params.component) document.title = `Terminal · ${params.component}`;
    // Params are captured in state — drop just the query string, preserving the
    // pathname (incl. any app base path in subpath deployments).
    window.history.replaceState(null, '', window.location.pathname);
  }, [params]);

  if (!params.execContext || !params.entity) {
    return (
      <Box className={classes.overlay} padding={2}>
        <Typography variant="body1">
          Missing terminal parameters (namespace, project, component,
          environment).
        </Typography>
      </Box>
    );
  }

  return (
    <EntityProvider entity={params.entity}>
      <Box className={classes.overlay}>
        <ResourcePodTerminalViewer
          execContext={params.execContext}
          podName={params.pod}
          containers={params.containers}
          initialContainer={params.initialContainer}
          autoConnect
          fullWindow
        />
      </Box>
    </EntityProvider>
  );
};
