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
import type { IncidentSummary } from '../../types';
import { useLogsTableStyles } from '../RuntimeLogs/styles';
import { IncidentRow } from './IncidentRow';

interface IncidentsTableProps {
  incidents: IncidentSummary[];
  loading: boolean;
  namespaceName: string;
  projectName: string;
  environmentName?: string;
  onViewRCA?: (incident: IncidentSummary) => void;
  onAcknowledge?: (incident: IncidentSummary) => void;
  onResolve?: (incident: IncidentSummary) => void;
  updatingIncidentId?: string | null;
}

export const IncidentsTable: FC<IncidentsTableProps> = ({
  incidents,
  loading,
  namespaceName,
  projectName,
  environmentName = '',
  onViewRCA,
  onAcknowledge,
  onResolve,
  updatingIncidentId,
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
        <TableCell>
          <Skeleton variant="text" width="100%" />
        </TableCell>
      </TableRow>
    ));

  const renderEmptyState = () => (
    <TableRow>
      <TableCell colSpan={6}>
        <Box className={classes.emptyState}>
          <Typography variant="h6" gutterBottom>
            No incidents found
          </Typography>
          <Typography variant="body2">
            No incidents match the current filters in the selected time range.
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );

  return (
    <Paper className={classes.tablePaper}>
      <Box className={classes.tableContainer}>
        <Table className={classes.table} size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell className={classes.headerCell} width="15%">
                Time
              </TableCell>
              <TableCell className={classes.headerCell} width="12%">
                Incident ID
              </TableCell>
              <TableCell className={classes.headerCell} width="10%">
                Status
              </TableCell>
              <TableCell className={classes.headerCell}>Description</TableCell>
              <TableCell className={classes.headerCell} width="12%">
                Component
              </TableCell>
              <TableCell className={classes.headerCell} width="15%">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && renderLoadingSkeletons()}
            {!loading && incidents.length === 0 && renderEmptyState()}
            {!loading &&
              incidents.map(incident => (
                <IncidentRow
                  key={incident.incidentId}
                  incident={incident}
                  namespaceName={namespaceName}
                  projectName={projectName}
                  environmentName={environmentName}
                  onViewRCA={onViewRCA ?? (() => {})}
                  onAcknowledge={onAcknowledge}
                  onResolve={onResolve}
                  updating={updatingIncidentId === incident.incidentId}
                />
              ))}
          </TableBody>
        </Table>
      </Box>
      {loading && incidents.length > 0 && (
        <Box className={classes.loadingContainer}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Paper>
  );
};
