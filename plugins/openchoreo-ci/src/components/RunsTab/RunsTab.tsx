import { Table, TableColumn } from '@backstage/core-components';
import { Typography, Box, IconButton, Tooltip } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { BuildStatusChip } from '../BuildStatusChip';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { extractGitFieldValues } from '../../utils/schemaExtensions';
import type { GitFieldMapping } from '../../utils/schemaExtensions';
import { formatRetentionDuration } from '../../hooks';
import { useStyles } from './styles';

interface RunsTabProps {
  builds: ModelsBuild[];
  loading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onRowClick: (build: ModelsBuild) => void;
  gitFieldMapping?: GitFieldMapping;
  retentionTtl?: string;
}

export const RunsTab = ({
  builds,
  loading,
  isRefreshing,
  onRefresh,
  onRowClick,
  gitFieldMapping,
  retentionTtl,
}: RunsTabProps) => {
  const classes = useStyles();

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
        const gitValues = extractGitFieldValues(
          build.parameters,
          gitFieldMapping ?? {},
        );
        const display = gitValues.commit || build.commit || 'latest';
        return (
          <Typography variant="body2" color="textSecondary">
            {display !== 'latest' ? String(display).substring(0, 8) : 'latest'}
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
            {retentionTtl && (
              <Tooltip
                title={`Runs are retained for ${formatRetentionDuration(
                  retentionTtl,
                )}`}
                placement="top"
                arrow
              >
                <IconButton
                  size="small"
                  aria-label="Retention period info"
                  style={{ marginLeft: '4px', padding: '4px' }}
                >
                  <InfoOutlinedIcon
                    style={{
                      fontSize: '16px',
                      color: '#6b778c',
                    }}
                  />
                </IconButton>
              </Tooltip>
            )}
            <IconButton
              size="small"
              onClick={onRefresh}
              disabled={isRefreshing || loading}
              style={{ marginLeft: '4px' }}
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
            {retentionTtl && (
              <Typography
                variant="body2"
                color="textSecondary"
                style={{ marginTop: '8px' }}
              >
                {`Completed runs are automatically removed after ${formatRetentionDuration(
                  retentionTtl,
                )}`}
              </Typography>
            )}
          </Box>
        }
      />
    </Box>
  );
};
