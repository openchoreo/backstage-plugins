import { FC } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import type { AlertSummary } from '../../types';
import { useLogsTableStyles } from '../RuntimeLogs/styles';
import { AlertRow } from './AlertRow';

interface AlertsTableProps {
  alerts: AlertSummary[];
  loading: boolean;
  environmentName?: string;
  projectName?: string;
  componentName?: string;
  namespaceName?: string;
  onViewIncident?: (alert: AlertSummary) => void;
}

export const AlertsTable: FC<AlertsTableProps> = ({
  alerts,
  loading,
  environmentName = '',
  projectName = '',
  componentName = '',
  namespaceName = 'default',
  onViewIncident,
}) => {
  const classes = useLogsTableStyles();

  const renderLoadingSkeletons = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell>
          <Skeleton variant="text" width="100%" />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width="100%" />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width="100%" />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width="100%" />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width="100%" />
        </TableCell>
      </TableRow>
    ));

  const renderEmptyState = () => (
    <TableRow>
      <TableCell colSpan={5}>
        <Box className={classes.emptyState}>
          <Typography variant="h6" gutterBottom>
            No alerts found
          </Typography>
          <Typography variant="body2">
            No alerts match the current filters in the selected time range.
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );

  const filteredAlerts = alerts;

  return (
    <Paper className={classes.tablePaper}>
      <Box className={classes.tableContainer}>
        <Table className={classes.table} size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell className={classes.headerCell}>Time</TableCell>
              <TableCell className={classes.headerCell}>Rule</TableCell>
              <TableCell className={classes.headerCell}>Severity</TableCell>
              <TableCell className={classes.headerCell}>Source</TableCell>
              <TableCell className={classes.headerCell}>Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && renderLoadingSkeletons()}
            {!loading && filteredAlerts.length === 0 && renderEmptyState()}
            {!loading &&
              filteredAlerts.map(alert => (
                <AlertRow
                  key={alert.alertId}
                  alert={alert}
                  environmentName={environmentName}
                  projectName={projectName}
                  componentName={componentName}
                  namespaceName={namespaceName}
                  onViewIncident={onViewIncident ?? (() => {})}
                />
              ))}
          </TableBody>
        </Table>
      </Box>
      {loading && filteredAlerts.length > 0 && (
        <Box className={classes.loadingContainer}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Paper>
  );
};
