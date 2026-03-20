import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Box, Typography, Button, Snackbar } from '@material-ui/core';
import { EmptyState, Progress, WarningIcon } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { IncidentsFilter } from './IncidentsFilter';
import { IncidentsTable } from './IncidentsTable';
import { IncidentsActions } from './IncidentsActions';
import {
  useGetEnvironmentsByNamespace,
  useGetComponentsByProject,
  useProjectIncidents,
  useUrlFiltersForIncidents,
  useUpdateIncident,
} from '../../hooks';
import { useIncidentsPermission } from '@openchoreo/backstage-plugin-react';
import { useRuntimeLogsStyles } from '../RuntimeLogs/styles';
import type { Environment as RuntimeLogsEnvironment } from '../RuntimeLogs/types';
import type { IncidentSummary } from '../../types';

const ObservabilityProjectIncidentsContent = () => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name || '';

  const {
    environments: observabilityEnvironments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByNamespace(namespace);

  const {
    components,
    loading: componentsLoading,
    error: componentsError,
  } = useGetComponentsByProject(entity);

  const environments = useMemo<RuntimeLogsEnvironment[]>(() => {
    return observabilityEnvironments.map(env => ({
      id: env.name,
      name: env.displayName || env.name,
      resourceName: env.name,
    }));
  }, [observabilityEnvironments]);

  const { filters, updateFilters } = useUrlFiltersForIncidents({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.id === filters.environmentId,
  );

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [updatingIncidentId, setUpdatingIncidentId] = useState<string | null>(
    null,
  );
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const { updateIncident } = useUpdateIncident();

  const {
    incidents,
    loading: incidentsLoading,
    error: incidentsError,
    fetchIncidents,
    refresh,
  } = useProjectIncidents(entity, {
    environmentId: filters.environmentId,
    environmentName: selectedEnvironment?.resourceName || '',
    timeRange: filters.timeRange,
    componentIds: filters.componentIds,
    sortOrder: filters.sortOrder || 'desc',
  });

  const previousFiltersRef = useRef<{
    environmentId: string;
    timeRange: string;
    componentIds: string[];
    sortOrder?: 'asc' | 'desc';
  } | null>(null);

  useEffect(() => {
    const currentFilters = {
      environmentId: filters.environmentId,
      timeRange: filters.timeRange,
      componentIds: filters.componentIds || [],
      sortOrder: filters.sortOrder,
    };
    const filtersChanged =
      previousFiltersRef.current === null ||
      JSON.stringify(previousFiltersRef.current) !==
        JSON.stringify(currentFilters);

    if (
      filters.environmentId &&
      selectedEnvironment &&
      namespace &&
      projectName &&
      filtersChanged
    ) {
      fetchIncidents(true);
      setLastUpdated(new Date());
      previousFiltersRef.current = currentFilters;
    }
  }, [
    filters.environmentId,
    filters.timeRange,
    filters.componentIds,
    filters.sortOrder,
    fetchIncidents,
    selectedEnvironment,
    namespace,
    projectName,
  ]);

  useEffect(() => {
    if (!incidentsLoading) setLastUpdated(new Date());
  }, [incidentsLoading]);

  const handleRefresh = () => {
    refresh();
    setLastUpdated(new Date());
  };

  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters);
  };

  const filteredIncidents = useMemo((): IncidentSummary[] => {
    let result = incidents;
    if (filters.status && filters.status.length > 0) {
      result = result.filter(
        i =>
          i.status &&
          filters.status!.some(
            s => s.toLowerCase() === (i.status || '').toLowerCase(),
          ),
      );
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        i =>
          (i.description || '').toLowerCase().includes(q) ||
          (i.incidentId || '').toLowerCase().includes(q) ||
          (i.alertId || '').toLowerCase().includes(q) ||
          (i.componentName || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [incidents, filters.status, filters.searchQuery]);

  // Open the RCA Reports tab of this project entity in a new browser tab,
  // pre-filtered by environment, time range, and alert ID.
  const handleViewRCA = useCallback(
    (incident: IncidentSummary) => {
      const catalogNs = entity.metadata.namespace || 'default';
      const params = new URLSearchParams({
        ...(filters.environmentId ? { env: filters.environmentId } : {}),
        ...(filters.timeRange ? { timeRange: filters.timeRange } : {}),
        ...(incident.alertId ? { q: incident.alertId } : {}),
      });
      const query = params.toString();
      const url = `/catalog/${catalogNs}/system/${projectName}/rca-reports${
        query ? `?${query}` : ''
      }`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [entity, projectName, filters.environmentId, filters.timeRange],
  );

  const handleAcknowledge = useCallback(
    async (incident: IncidentSummary) => {
      setUpdatingIncidentId(incident.incidentId);
      try {
        await updateIncident(incident, 'acknowledged');
        refresh();
        setLastUpdated(new Date());
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setSnackbarMessage(
          `Failed to acknowledge incident ${incident.incidentId}: ${detail}`,
        );
      } finally {
        setUpdatingIncidentId(null);
      }
    },
    [updateIncident, refresh],
  );

  const handleResolve = useCallback(
    async (incident: IncidentSummary) => {
      setUpdatingIncidentId(incident.incidentId);
      try {
        await updateIncident(incident, 'resolved');
        refresh();
        setLastUpdated(new Date());
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setSnackbarMessage(
          `Failed to resolve incident ${incident.incidentId}: ${detail}`,
        );
      } finally {
        setUpdatingIncidentId(null);
      }
    },
    [updateIncident, refresh],
  );

  const renderError = (error: string) => {
    const isObservabilityDisabled = error.includes(
      'Observability is not enabled',
    );
    return (
      <Alert
        severity={isObservabilityDisabled ? 'info' : 'error'}
        className={classes.errorContainer}
      >
        <Typography variant="body1">
          {isObservabilityDisabled
            ? 'Observability is not enabled for this project. Please enable observability to view incidents.'
            : error}
        </Typography>
        {!isObservabilityDisabled && (
          <Button onClick={handleRefresh} color="inherit" size="small">
            Retry
          </Button>
        )}
      </Alert>
    );
  };

  if (environmentsError) {
    return <Box>{renderError(environmentsError)}</Box>;
  }

  if (componentsError) {
    return <Box>{renderError(componentsError)}</Box>;
  }

  return (
    <Box>
      <IncidentsFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        environments={environments}
        environmentsLoading={environmentsLoading}
        components={components}
        componentsLoading={componentsLoading}
        disabled={incidentsLoading}
      />

      {incidentsError && renderError(incidentsError)}

      {!filters.environmentId &&
        !environmentsLoading &&
        environments.length === 0 && (
          <Alert severity="info" className={classes.errorContainer}>
            <Typography variant="body1">
              No environments found for this project.
            </Typography>
          </Alert>
        )}

      {filters.environmentId && (
        <>
          <IncidentsActions
            totalCount={filteredIncidents.length}
            disabled={incidentsLoading || !filters.environmentId}
            onRefresh={handleRefresh}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            lastUpdated={lastUpdated}
          />

          <IncidentsTable
            incidents={filteredIncidents}
            loading={incidentsLoading}
            namespaceName={namespace}
            projectName={projectName}
            environmentName={selectedEnvironment?.name}
            onViewRCA={handleViewRCA}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
            updatingIncidentId={updatingIncidentId}
          />
        </>
      )}

      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={6000}
        onClose={() => setSnackbarMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarMessage(null)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export const ObservabilityProjectIncidentsPage = () => {
  const {
    canViewIncidents,
    loading: permissionLoading,
    deniedTooltip,
  } = useIncidentsPermission();

  if (permissionLoading) return <Progress />;

  if (!canViewIncidents) {
    return (
      <EmptyState
        missing="data"
        title="Permission Denied"
        description={
          <Box display="flex" alignItems="center" gridGap={8}>
            <WarningIcon />
            {deniedTooltip}
          </Box>
        }
      />
    );
  }

  return <ObservabilityProjectIncidentsContent />;
};
