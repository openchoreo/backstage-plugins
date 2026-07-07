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
  onViewCostAnalysis?: (incident: IncidentSummary) => void;
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
  onViewCostAnalysis,
  onAcknowledge,
  onResolve,
  updatingIncidentId,
}) => {
  const classes = useLogsTableStyles();

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
              <TableCell scope="col" className={classes.headerCell} width="15%">
                Time
              </TableCell>
              <TableCell scope="col" className={classes.headerCell} width="12%">
                Incident ID
              </TableCell>
              <TableCell scope="col" className={classes.headerCell} width="10%">
                Status
              </TableCell>
              <TableCell scope="col" className={classes.headerCell}>
                Description
              </TableCell>
              <TableCell scope="col" className={classes.headerCell} width="12%">
                Component
              </TableCell>
              <TableCell scope="col" className={classes.headerCell} width="15%">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && <SkeletonRows rows={5} cols={6} />}
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
                  onViewCostAnalysis={onViewCostAnalysis}
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
