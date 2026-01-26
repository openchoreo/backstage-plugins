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
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
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

export const EnvironmentDeployedComponentsCard = () => {
  const classes = useEnvironmentOverviewStyles();
  const { entity } = useEntity();
  const { components, loading, error, refresh } =
    useEnvironmentDeployedComponents(entity);

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
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
      <Card padding={24} className={classes.card}>
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
      <Card padding={24} className={classes.card}>
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
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Deployed Components</Typography>
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
            {components.map(component => (
              <TableRow key={`${component.projectName}-${component.name}`}>
                <TableCell>
                  <Link
                    to={`/catalog/default/component/${component.name}`}
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
                      to={`/catalog/default/component/${component.name}`}
                    >
                      <LaunchIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};
