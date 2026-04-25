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
import type { Trigger } from './types';
import { useLogsTableStyles } from '../RuntimeLogs/styles';
import { TriggerRow } from './TriggerRow';

interface TriggersTableProps {
  triggers: Trigger[];
  loading: boolean;
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName: string;
}

export const TriggersTable: FC<TriggersTableProps> = ({
  triggers,
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
      </TableRow>
    ));

  const renderEmptyState = () => (
    <TableRow>
      <TableCell colSpan={5}>
        <Box className={classes.emptyState}>
          <Typography variant="h6" gutterBottom>
            No triggers found
          </Typography>
          <Typography variant="body2">
            No scheduled task triggers match the current filters in the selected
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
              <TableCell className={classes.headerCell} style={{ width: 100 }}>
                Status
              </TableCell>
              <TableCell className={classes.headerCell}>Job Name</TableCell>
              <TableCell className={classes.headerCell} style={{ width: 180 }}>
                Start Time
              </TableCell>
              <TableCell className={classes.headerCell} style={{ width: 180 }}>
                Completion Time
              </TableCell>
              <TableCell className={classes.headerCell} style={{ width: 80 }}>
                Events
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && triggers.length === 0 && renderLoadingSkeletons()}
            {!loading && triggers.length === 0 && renderEmptyState()}
            {triggers.map(trigger => (
              <TriggerRow
                key={trigger.jobName}
                trigger={trigger}
                namespaceName={namespaceName}
                projectName={projectName}
                environmentName={environmentName}
                componentName={componentName}
              />
            ))}
          </TableBody>
        </Table>
      </Box>
      {loading && triggers.length > 0 && (
        <Box className={classes.loadingContainer}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Paper>
  );
};
