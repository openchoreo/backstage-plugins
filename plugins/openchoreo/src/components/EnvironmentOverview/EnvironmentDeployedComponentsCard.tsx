import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import LaunchIcon from '@material-ui/icons/Launch';
import RefreshIcon from '@material-ui/icons/Refresh';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import ClearIcon from '@material-ui/icons/Clear';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { parseEntityRef } from '@backstage/catalog-model';
import { Card } from '@openchoreo/backstage-design-system';
import {
  useEnvironmentDeployedComponents,
  type DeployedComponent,
} from './hooks';
import { useEnvironmentOverviewStyles } from './styles';

const StatusChip = ({
  status,
  classes,
}: {
  status: DeployedComponent['status'];
  classes: ReturnType<typeof useEnvironmentOverviewStyles>;
}) => {
  const getChipClass = () => {
    switch (status) {
      case 'Ready':
        return classes.chipActive;
      case 'NotReady':
        return classes.chipDegraded;
      case 'Failed':
        return classes.chipFailed;
      case 'Pending':
      default:
        return classes.chipPending;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'Ready':
        return 'Active';
      case 'NotReady':
        return 'Degraded';
      case 'Failed':
        return 'Failed';
      case 'Pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  return (
    <Chip
      size="small"
      label={getLabel()}
      className={clsx(classes.chip, getChipClass())}
    />
  );
};

// Map status filter to component status
const statusFilterMap: Record<string, DeployedComponent['status'][]> = {
  healthy: ['Ready'],
  degraded: ['NotReady'],
  failed: ['Failed'],
  pending: ['Pending'],
};

export const EnvironmentDeployedComponentsCard = () => {
  const classes = useEnvironmentOverviewStyles();
  const { entity } = useEntity();
  const { components, loading, error, refresh } =
    useEnvironmentDeployedComponents(entity);

  // Get initial filter from URL
  const getInitialFilter = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('status') || null;
  };

  const [statusFilter, setStatusFilter] = useState<string | null>(
    getInitialFilter,
  );

  // Listen for status filter changes from the summary card
  const handleStatusFilterChange = useCallback(
    (event: CustomEvent<{ status: string }>) => {
      setStatusFilter(event.detail.status);
    },
    [],
  );

  useEffect(() => {
    window.addEventListener(
      'statusFilterChange',
      handleStatusFilterChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        'statusFilterChange',
        handleStatusFilterChange as EventListener,
      );
    };
  }, [handleStatusFilterChange]);

  // Clear filter
  const clearFilter = () => {
    setStatusFilter(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('status');
    window.history.pushState({}, '', url.toString());
  };

  // Filter components based on status
  const filteredComponents = statusFilter
    ? components.filter(c => statusFilterMap[statusFilter]?.includes(c.status))
    : components;

  if (loading) {
    return (
      <Card padding={24} className={classes.card} id="deployed-components-card">
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={200} height={28} />
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell>Release</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Endpoints</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[1, 2, 3].map(i => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding={24} className={classes.card} id="deployed-components-card">
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployed Components
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2" color="error">
            Failed to load deployed components
          </Typography>
        </Box>
      </Card>
    );
  }

  if (components.length === 0) {
    return (
      <Card padding={24} className={classes.card} id="deployed-components-card">
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployed Components
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            No components deployed to this environment
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={24} className={classes.card} id="deployed-components-card">
      <Box className={classes.cardHeader}>
        <Box display="flex" alignItems="center" gridGap={8}>
          <Typography variant="h5">Deployed Components</Typography>
          {statusFilter && (
            <Chip
              size="small"
              label={`Filtered: ${statusFilter}`}
              onDelete={clearFilter}
              deleteIcon={<ClearIcon />}
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={refresh}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <TableContainer className={classes.tableContainer}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Component</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Release</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Endpoints</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredComponents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No components match the selected filter
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredComponents.map(component => (
                <TableRow key={`${component.projectName}-${component.name}`}>
                  <TableCell>
                    <Link
                      to={`/catalog/${
                        parseEntityRef(component.entityRef).namespace
                      }/component/${component.name}`}
                      className={classes.componentLink}
                    >
                      {component.displayName || component.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {component.projectName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {component.releaseVersion || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={component.status} classes={classes} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {component.endpoints || 0} routes
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Component">
                      <IconButton
                        size="small"
                        component={Link}
                        to={`/catalog/${
                          parseEntityRef(component.entityRef).namespace
                        }/component/${component.name}`}
                      >
                        <LaunchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};
