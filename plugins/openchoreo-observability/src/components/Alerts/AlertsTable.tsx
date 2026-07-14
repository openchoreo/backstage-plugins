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
import { SkeletonRows } from '@openchoreo/backstage-plugin-react';
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
  onViewCostAnalysis?: (alert: AlertSummary) => void;
}

export const AlertsTable: FC<AlertsTableProps> = ({
  alerts,
  loading,
  environmentName = '',
  projectName = '',
  componentName = '',
  namespaceName = 'default',
  onViewIncident,
  onViewCostAnalysis,
}) => {
  const classes = useLogsTableStyles();

  const renderEmptyState = () => (
    <TableRow>
      <TableCell colSpan={5}>
        <Box className={classes.emptyState}>
          <Typography variant="h6" gutterBottom>
            No alerts found
          </Typography>
          <Typography variant="body2">
            No alerts found for the selected time range and filters.
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
              <TableCell scope="col" className={classes.headerCell}>
                Time
              </TableCell>
              <TableCell scope="col" className={classes.headerCell}>
                Rule
              </TableCell>
              <TableCell scope="col" className={classes.headerCell}>
                Severity
              </TableCell>
              <TableCell scope="col" className={classes.headerCell}>
                Source
              </TableCell>
              <TableCell scope="col" className={classes.headerCell}>
                Value
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && <SkeletonRows rows={5} cols={5} />}
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
                  onViewCostAnalysis={onViewCostAnalysis}
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
