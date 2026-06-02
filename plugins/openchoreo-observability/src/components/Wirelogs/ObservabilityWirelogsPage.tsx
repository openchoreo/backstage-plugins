import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@material-ui/lab';
import { Box, Tooltip, Typography } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  ForbiddenState,
  useWirelogsPermission,
} from '@openchoreo/backstage-plugin-react';
import {
  useGetNamespaceAndProjectByEntity,
  useWirelogsEnvironments,
} from '../../hooks';
import { WirelogsFilter } from './WirelogsFilter';
import { WirelogsStats } from './WirelogsStats';
import { WirelogsTable, matchesSearch } from './WirelogsTable';
import { useWirelogsStream } from './useWirelogsStream';
import { useWirelogsStyles } from './styles';
import type { WirelogsFilters } from './types';

const ObservabilityWirelogsContent = () => {
  const classes = useWirelogsStyles();
  const { entity } = useEntity();
  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);
  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const componentScopeMissing = entity.kind === 'Component' && !componentName;

  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useWirelogsEnvironments(project, namespace);

  const [filters, setFilters] = useState<WirelogsFilters>({
    environment: null,
    searchQuery: '',
  });

  // Pick the first environment (in deployment-pipeline order) once they load.
  useEffect(() => {
    if (!filters.environment && environments.length > 0) {
      setFilters(prev => ({ ...prev, environment: environments[0] }));
    }
  }, [environments, filters.environment]);

  const anyEnvHasWirelogs = useMemo(
    () => environments.some(e => e.hasWirelogs),
    [environments],
  );
  const selectedEnvHasWirelogs =
    environments.find(e => e.name === filters.environment?.name)?.hasWirelogs ??
    false;

  const {
    canViewWirelogs: canViewForEnv,
    loading: envPermissionLoading,
    deniedTooltip: envPermissionDenied,
    permissionName: envPermissionName,
  } = useWirelogsPermission(filters.environment?.name);

  const stream = useWirelogsStream({
    namespaceName: namespace,
    projectName: project,
    environmentName: componentScopeMissing
      ? undefined
      : filters.environment?.name,
    componentName,
  });

  const { status: streamStatus, stop: stopStream } = stream;
  useEffect(() => {
    if (
      !environmentsLoading &&
      filters.environment &&
      !selectedEnvHasWirelogs &&
      (streamStatus === 'streaming' || streamStatus === 'connecting')
    ) {
      stopStream();
    }
  }, [
    environmentsLoading,
    filters.environment,
    selectedEnvHasWirelogs,
    streamStatus,
    stopStream,
  ]);

  // Component scoping is applied upstream via the Hubble filter; only the
  // free-text search box is applied client-side here.
  const visibleFlows = useMemo(
    () => stream.flows.filter(e => matchesSearch(e, filters.searchQuery)),
    [stream.flows, filters.searchQuery],
  );

  const stats = useMemo(() => {
    let allowed = 0;
    let dropped = 0;
    for (const e of visibleFlows) {
      if (e.flow.verdict === 'DROPPED') dropped += 1;
      else if (e.flow.verdict === 'FORWARDED') allowed += 1;
    }
    return { allowed, dropped };
  }, [visibleFlows]);

  const handleFiltersChange = (next: Partial<WirelogsFilters>) => {
    setFilters(prev => ({ ...prev, ...next }));
  };

  const handleDownload = () => {
    const payload = JSON.stringify(visibleFlows, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `wirelogs-${project ?? 'project'}-${
      filters.environment?.name ?? 'env'
    }-${ts}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (environmentsError) {
    return (
      <Box>
        <Alert severity="error" className={classes.errorContainer}>
          <Typography variant="body1">{environmentsError}</Typography>
        </Alert>
      </Box>
    );
  }

  if (componentScopeMissing) {
    return (
      <Box>
        <Alert severity="error" className={classes.errorContainer}>
          <Typography variant="body1">
            This component is missing the {CHOREO_ANNOTATIONS.COMPONENT}{' '}
            annotation, so wirelogs cannot be scoped to it.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const isStreaming =
    stream.status === 'streaming' || stream.status === 'connecting';

  const noEnvSupportsWirelogs =
    !environmentsLoading && environments.length > 0 && !anyEnvHasWirelogs;
  const selectedEnvUnsupported =
    !!filters.environment &&
    !environmentsLoading &&
    !selectedEnvHasWirelogs &&
    !noEnvSupportsWirelogs;

  const toolbar = (
    <WirelogsFilter
      filters={filters}
      onFiltersChange={handleFiltersChange}
      environments={environments}
      environmentsLoading={environmentsLoading}
      status={stream.status}
      onStart={stream.start}
      onStop={stream.stop}
      onClear={stream.clear}
      onDownload={handleDownload}
      disabled={noEnvSupportsWirelogs}
      startDisabled={selectedEnvUnsupported}
    />
  );

  return (
    <Box>
      {noEnvSupportsWirelogs ? (
        <Tooltip title="Wirelogs are unavailable in all environments. Configure the Cilium module to enable network observability.">
          <span>{toolbar}</span>
        </Tooltip>
      ) : (
        toolbar
      )}

      {stream.error && (
        <Alert severity="error" className={classes.errorContainer}>
          {stream.error}
        </Alert>
      )}

      {!filters.environment &&
        !environmentsLoading &&
        environments.length === 0 && (
          <Alert severity="info" className={classes.errorContainer}>
            <Typography variant="body1">
              No environments found. Make sure your component is deployed.
            </Typography>
          </Alert>
        )}

      {filters.environment && !envPermissionLoading && !canViewForEnv && (
        <ForbiddenState
          message={envPermissionDenied}
          permissionName={envPermissionName}
          variant="compact"
        />
      )}

      {canViewForEnv && noEnvSupportsWirelogs && (
        <Alert severity="warning" className={classes.errorContainer}>
          <Typography variant="body1">
            Wirelogs require the Cilium network observability module, which
            isn't configured on any of this project's environments. Configure
            the Cilium module on a DataPlane to stream wirelogs.
          </Typography>
        </Alert>
      )}

      {canViewForEnv && selectedEnvUnsupported && filters.environment && (
        <Alert severity="warning" className={classes.errorContainer}>
          <Typography variant="body1">
            Wirelogs are unavailable in the{' '}
            <strong>
              {filters.environment.displayName || filters.environment.name}
            </strong>{' '}
            environment. Configure the Cilium module on its DataPlane to enable
            network observability.
          </Typography>
        </Alert>
      )}

      {filters.environment && canViewForEnv && selectedEnvHasWirelogs && (
        <>
          <WirelogsStats
            visibleCount={visibleFlows.length}
            totalLoaded={stream.totalReceived}
            allowed={stats.allowed}
            dropped={stats.dropped}
          />
          <WirelogsTable flows={visibleFlows} isStreaming={isStreaming} />
        </>
      )}
    </Box>
  );
};

export const ObservabilityWirelogsPage = () => {
  const {
    canViewWirelogs,
    loading: permissionLoading,
    deniedTooltip,
    permissionName,
  } = useWirelogsPermission();

  if (permissionLoading) {
    return <Progress />;
  }

  if (!canViewWirelogs) {
    return (
      <ForbiddenState
        message={deniedTooltip}
        permissionName={permissionName}
        variant="fullpage"
      />
    );
  }

  return <ObservabilityWirelogsContent />;
};
