import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Box, Typography, Button, Snackbar } from '@material-ui/core';
import { EmptyState, Progress, WarningIcon } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RefreshOverlay } from '@openchoreo/backstage-design-system';
import { IncidentsFilter } from './IncidentsFilter';
import { IncidentsTable } from './IncidentsTable';
import { IncidentsActions } from './IncidentsActions';
import {
  useGetComponentsByProject,
  useProjectIncidents,
  useUrlFiltersForIncidents,
  useUpdateIncident,
} from '../../hooks';
import {
  useIncidentsPermission,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { EnvironmentsStatusNotice } from '../common';
import { useRuntimeLogsStyles } from '../RuntimeLogs/styles';
import type { IncidentSummary } from '../../types';

const ObservabilityProjectIncidentsContent = () => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name || '';

  const {
    environments,
    loading: environmentsLoading,
    status: environmentsStatus,
  } = useProjectEnvironments(projectName, namespace);

  const {
    components,
    loading: componentsLoading,
    error: componentsError,
  } = useGetComponentsByProject(entity);

  const { filters, updateFilters } = useUrlFiltersForIncidents({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.name === filters.environment,
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
    isRefetching,
    error: incidentsError,
    refresh,
  } = useProjectIncidents(entity, {
    environment: filters.environment,
    timeRange: filters.timeRange,
    customStartTime: filters.customStartTime,
    customEndTime: filters.customEndTime,
    components: filters.components,
    sortOrder: filters.sortOrder || 'desc',
  });

  const previousFiltersRef = useRef<{
    environment: string;
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
    components: string[];
    sortOrder?: 'asc' | 'desc';
  } | null>(null);

  useEffect(() => {
    const currentFilters = {
      environment: filters.environment,
      timeRange: filters.timeRange,
      customStartTime: filters.customStartTime,
      customEndTime: filters.customEndTime,
      components: filters.components || [],
      sortOrder: filters.sortOrder,
    };
    const filtersChanged =
      previousFiltersRef.current === null ||
      JSON.stringify(previousFiltersRef.current) !==
        JSON.stringify(currentFilters);

    if (
      filters.environment &&
      selectedEnvironment &&
      namespace &&
      projectName &&
      filtersChanged
    ) {
      // The incidents query keys on these filters, so it refetches on its own
      // when they change — this effect only stamps the "last updated" time.
      setLastUpdated(new Date());
      previousFiltersRef.current = currentFilters;
    }
  }, [
    filters.environment,
    filters.timeRange,
    filters.customStartTime,
    filters.customEndTime,
    filters.components,
    filters.sortOrder,
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
        ...(filters.environment ? { env: filters.environment } : {}),
        ...(filters.timeRange ? { timeRange: filters.timeRange } : {}),
        ...(incident.alertId ? { q: incident.alertId } : {}),
      });
      const query = params.toString();
      const url = `/catalog/${catalogNs}/system/${projectName}/rca-reports${
        query ? `?${query}` : ''
      }`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [entity, projectName, filters.environment, filters.timeRange],
  );

  // Open the Cost Analysis tab of this project entity in a new browser tab,
  // pre-filtered by environment and time range.
  const handleViewCostAnalysis = useCallback(
    (_incident: IncidentSummary) => {
      const catalogNs = entity.metadata.namespace || 'default';
      const params = new URLSearchParams({
        ...(filters.environment ? { env: filters.environment } : {}),
        ...(filters.timeRange ? { timeRange: filters.timeRange } : {}),
      });
      const query = params.toString();
      const url = `/catalog/${catalogNs}/system/${projectName}/cost-analysis${
        query ? `?${query}` : ''
      }`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [entity, projectName, filters.environment, filters.timeRange],
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
            ? 'Observability is not enabled for this project. Enable observability to view incidents.'
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

  if (environmentsLoading) {
    return <Progress />;
  }

  if (environmentsStatus !== 'ok') {
    return (
      <Box>
        <EnvironmentsStatusNotice
          status={environmentsStatus}
          feature="incidents"
        />
      </Box>
    );
  }

  if (componentsError) {
    return <Box>{renderError(componentsError)}</Box>;
  }

  return (
    <Box position="relative">
      <RefreshOverlay active={isRefetching} label="Refreshing incidents" />
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

      {filters.environment && (
        <>
          <IncidentsActions
            totalCount={filteredIncidents.length}
            disabled={incidentsLoading || !filters.environment}
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
            environmentName={
              selectedEnvironment?.displayName || selectedEnvironment?.name
            }
            onViewRCA={handleViewRCA}
            onViewCostAnalysis={handleViewCostAnalysis}
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
