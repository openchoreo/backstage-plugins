import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { PageLoader } from '@openchoreo/backstage-design-system';
import { Box, Typography, Button } from '@material-ui/core';
import { EmptyState, WarningIcon } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RefreshOverlay } from '@openchoreo/backstage-design-system';
import { AlertsFilter } from './AlertsFilter';
import { AlertsTable } from './AlertsTable';
import { AlertsActions } from './AlertsActions';
import {
  useComponentAlerts,
  useGetNamespaceAndProjectByEntity,
  useUrlFiltersForAlerts,
} from '../../hooks';
import {
  useAlertsPermission,
  pickRangeForAge,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { EnvironmentsStatusNotice } from '../common';
import { useRuntimeLogsStyles } from '../RuntimeLogs/styles';
import type { AlertSummary } from '../../types';

const ObservabilityAlertsContent = () => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);

  const {
    environments,
    loading: environmentsLoading,
    status: environmentsStatus,
  } = useProjectEnvironments(project, namespace);

  const { filters, updateFilters } = useUrlFiltersForAlerts({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.name === filters.environment,
  );

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const {
    alerts,
    loading: alertsLoading,
    isRefetching,
    error: alertsError,
    refresh,
  } = useComponentAlerts(entity, namespace || '', project || '', {
    environment: filters.environment,
    timeRange: filters.timeRange,
    customStartTime: filters.customStartTime,
    customEndTime: filters.customEndTime,
    limit: 100,
    sortOrder: filters.sortOrder || 'desc',
  });

  const previousFiltersRef = useRef<{
    environment: string;
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
    sortOrder?: 'asc' | 'desc';
  } | null>(null);

  useEffect(() => {
    const currentFilters = {
      environment: filters.environment,
      timeRange: filters.timeRange,
      customStartTime: filters.customStartTime,
      customEndTime: filters.customEndTime,
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
      project &&
      componentName &&
      filtersChanged
    ) {
      // The alerts query keys on these filters, so it refetches on its own when
      // they change — this effect only stamps the "last updated" time.
      setLastUpdated(new Date());
      previousFiltersRef.current = currentFilters;
    }
  }, [
    filters.environment,
    filters.timeRange,
    filters.customStartTime,
    filters.customEndTime,
    filters.sortOrder,
    selectedEnvironment,
    namespace,
    project,
    componentName,
  ]);

  useEffect(() => {
    if (!alertsLoading) setLastUpdated(new Date());
  }, [alertsLoading]);

  const handleRefresh = () => {
    refresh();
    setLastUpdated(new Date());
  };

  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters);
  };

  const filteredAlerts = useMemo((): AlertSummary[] => {
    let result = alerts;
    if (filters.severity && filters.severity.length > 0) {
      result = result.filter(
        a =>
          a.severity &&
          filters.severity!.some(
            s => s.toLowerCase() === (a.severity || '').toLowerCase(),
          ),
      );
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        a =>
          (a.ruleName || '').toLowerCase().includes(q) ||
          (a.ruleDescription || '').toLowerCase().includes(q) ||
          (a.alertId || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [alerts, filters.severity, filters.searchQuery]);

  // Open the parent project's Incidents tab in a new browser tab, pre-filtered
  // by alertId and with a time range that covers the alert's age.
  const handleViewIncident = useCallback(
    (alert: AlertSummary) => {
      const parentProject =
        (entity.spec?.system as string | undefined) || project || '';
      const catalogNs = entity.metadata.namespace || 'default';
      if (!parentProject) return;

      const timeRange = alert.timestamp
        ? pickRangeForAge(Date.now() - new Date(alert.timestamp).getTime())
        : '1h';

      const params = new URLSearchParams({
        search: alert.alertId,
        timeRange,
        ...(filters.environment ? { env: filters.environment } : {}),
      });
      const url = `/catalog/${catalogNs}/system/${parentProject}/incidents?${params.toString()}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [entity, project, filters.environment],
  );

  // Open the parent project's Cost Analysis tab in a new browser tab,
  // pre-filtered by alertId and with a time range that covers the alert's age.
  const handleViewCostAnalysis = useCallback(
    (alert: AlertSummary) => {
      const parentProject =
        (entity.spec?.system as string | undefined) || project || '';
      const catalogNs = entity.metadata.namespace || 'default';
      if (!parentProject) return;

      const timeRange = alert.timestamp
        ? pickRangeForAge(Date.now() - new Date(alert.timestamp).getTime())
        : '1h';

      const params = new URLSearchParams({
        q: alert.alertId,
        timeRange,
        ...(filters.environment ? { env: filters.environment } : {}),
      });
      const url = `/catalog/${catalogNs}/system/${parentProject}/cost-analysis?${params.toString()}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [entity, project, filters.environment],
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
            ? 'Observability is not enabled for this component. Enable observability to view alerts.'
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
    return <PageLoader />;
  }

  if (environmentsStatus !== 'ok') {
    return (
      <Box>
        <EnvironmentsStatusNotice
          status={environmentsStatus}
          feature="alerts"
        />
      </Box>
    );
  }

  return (
    <Box position="relative">
      <RefreshOverlay active={isRefetching} label="Refreshing alerts" />
      <AlertsFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        environments={environments}
        environmentsLoading={environmentsLoading}
        disabled={alertsLoading}
      />

      {alertsError && renderError(alertsError)}

      {filters.environment && (
        <>
          <AlertsActions
            totalCount={filteredAlerts.length}
            disabled={alertsLoading || !filters.environment}
            onRefresh={handleRefresh}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            lastUpdated={lastUpdated}
          />

          <AlertsTable
            alerts={filteredAlerts}
            loading={alertsLoading}
            environmentName={
              selectedEnvironment?.displayName || selectedEnvironment?.name
            }
            projectName={project}
            componentName={componentName}
            namespaceName={namespace}
            onViewIncident={handleViewIncident}
            onViewCostAnalysis={handleViewCostAnalysis}
          />
        </>
      )}
    </Box>
  );
};

export const ObservabilityAlertsPage = () => {
  const {
    canViewAlerts,
    loading: permissionLoading,
    deniedTooltip,
  } = useAlertsPermission();

  if (permissionLoading) return <PageLoader />;

  if (!canViewAlerts) {
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

  return <ObservabilityAlertsContent />;
};
