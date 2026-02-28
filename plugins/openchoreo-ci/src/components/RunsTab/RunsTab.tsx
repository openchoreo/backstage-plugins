import { Table, TableColumn } from '@backstage/core-components';
import { Typography, Box, IconButton } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import { BuildStatusChip } from '../BuildStatusChip';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useStyles } from './styles';

/**
 * Retrieve a value from a nested object using a dot-delimited path.
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  let current: any = obj;
  for (const part of path.split('.')) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    )
      return undefined;
    current = current[part];
  }
  return current;
}

interface RunsTabProps {
  builds: ModelsBuild[];
  loading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onRowClick: (build: ModelsBuild) => void;
  /** Dot-delimited path into parameters where commit lives (from annotation). Null if not available. */
  commitParamPath?: string | null;
}

export const RunsTab = ({
  builds,
  loading,
  isRefreshing,
  onRefresh,
  onRowClick,
  commitParamPath,
}: RunsTabProps) => {
  const classes = useStyles();

  // Derive the lookup path by stripping the "parameters." prefix
  let commitLookupPath: string | null = null;
  if (commitParamPath) {
    commitLookupPath = commitParamPath.startsWith('parameters.')
      ? commitParamPath.slice('parameters.'.length)
      : commitParamPath;
  }

  const columns: TableColumn[] = [
    {
      title: 'Workflow Run Name',
      field: 'name',
      highlight: true,
    },
    {
      title: 'Status',
      field: 'status',
      render: (row: any) => (
        <BuildStatusChip status={(row as ModelsBuild).status} />
      ),
    },
    {
      title: 'Commit',
      field: 'commit',
      render: (row: any) => {
        const build = row as ModelsBuild;
        // Extract commit: annotation path → legacy build.commit → 'latest'
        const paramCommit =
          commitLookupPath && build.parameters
            ? getNestedValue(build.parameters, commitLookupPath)
            : null;
        const display = paramCommit || build.commit || 'latest';
        return display !== 'latest' ? (
          <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
            {String(display).substring(0, 8)}
          </Typography>
        ) : (
          <Typography variant="body2" color="textSecondary">
            latest
          </Typography>
        );
      },
    },
    {
      title: 'Time',
      field: 'time',
      render: (row: any) =>
        formatRelativeTime((row as ModelsBuild).createdAt || ''),
    },
  ];

  const sortedBuilds = [...builds].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );

  return (
    <Box className={classes.tableWrapper}>
      <Table
        title={
          <Box display="flex" alignItems="center">
            <Typography variant="h6" component="span">
              Workflow Runs
            </Typography>
            <IconButton
              size="small"
              onClick={onRefresh}
              disabled={isRefreshing || loading}
              style={{ marginLeft: '8px' }}
              title={isRefreshing ? 'Refreshing...' : 'Refresh builds'}
            >
              <Refresh style={{ fontSize: '18px' }} />
            </IconButton>
          </Box>
        }
        options={{
          search: true,
          paging: true,
          sorting: true,
        }}
        columns={columns}
        data={sortedBuilds}
        onRowClick={(_, rowData) => {
          onRowClick(rowData as ModelsBuild);
        }}
        emptyContent={
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            flexDirection="column"
            padding={4}
          >
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No workflow runs found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Trigger a workflow to see runs appear here
            </Typography>
          </Box>
        }
      />
    </Box>
  );
};
