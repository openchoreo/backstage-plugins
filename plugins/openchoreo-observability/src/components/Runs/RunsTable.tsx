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
import type { Run } from './types';
import { useLogsTableStyles } from '../RuntimeLogs/styles';
import { RunRow } from './RunRow';

interface RunsTableProps {
  runs: Run[];
  loading: boolean;
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName: string;
}

export const RunsTable: FC<RunsTableProps> = ({
  runs,
  loading,
  namespaceName,
  projectName,
  environmentName,
  componentName,
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
            No runs found
          </Typography>
          <Typography variant="body2">
            No scheduled task runs match the current filters in the selected
            time range.
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
              <TableCell className={classes.headerCell} style={{ width: 220 }}>
                Status
              </TableCell>
              <TableCell className={classes.headerCell}>Job Name</TableCell>
              <TableCell className={classes.headerCell} style={{ width: 180 }}>
                Start Time
              </TableCell>
              <TableCell className={classes.headerCell} style={{ width: 180 }}>
                Completion Time
              </TableCell>
              <TableCell className={classes.headerCell} style={{ width: 110 }}>
                Duration
              </TableCell>
              <TableCell className={classes.headerCell} style={{ width: 80 }}>
                Events
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && runs.length === 0 && renderLoadingSkeletons()}
            {!loading && runs.length === 0 && renderEmptyState()}
            {runs.map(run => (
              <RunRow
                key={run.jobName}
                run={run}
                namespaceName={namespaceName}
                projectName={projectName}
                environmentName={environmentName}
                componentName={componentName}
              />
            ))}
          </TableBody>
        </Table>
      </Box>
      {loading && runs.length > 0 && (
        <Box className={classes.loadingContainer}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Paper>
  );
};
