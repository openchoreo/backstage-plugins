import { useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import {
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { Typography, Box, IconButton } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import { BuildLogs } from './BuildLogs';
import { BuildStatusComponent } from './BuildStatusComponent';
import { ComponentDetailsCard } from './ComponentDetailsCard';
import { useBuildsData } from './useBuildsData';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import {
  formatRelativeTime,
  useComponentEntityDetails,
} from '@openchoreo/backstage-plugin-react';

const columns: TableColumn<ModelsBuild>[] = [
  {
    title: 'Build Name',
    field: 'name',
    highlight: true,
  },
  {
    title: 'Status',
    field: 'status',
    render: (row: ModelsBuild) => <BuildStatusComponent status={row.status} />,
  },
  {
    title: 'Commit',
    field: 'commit',
    render: (row: ModelsBuild) =>
      row.commit ? (
        <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
          {row.commit.substring(0, 8)}
        </Typography>
      ) : (
        'N/A'
      ),
  },
  {
    title: 'Time',
    field: 'time',
    render: (row: ModelsBuild) => formatRelativeTime(row.createdAt || ''),
  },
];

export const Builds = () => {
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const { getEntityDetails } = useComponentEntityDetails();

  const {
    builds,
    componentDetails,
    loading,
    error,
    triggeringBuild,
    refreshing,
    triggerBuild,
    refreshBuilds,
  } = useBuildsData(discoveryApi, identityApi, getEntityDetails);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<ModelsBuild | null>(null);

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  const sortedBuilds = [...builds].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );

  return (
    <Box>
      {componentDetails && (
        <ComponentDetailsCard
          componentDetails={componentDetails}
          onTriggerBuild={triggerBuild}
          triggeringBuild={triggeringBuild}
        />
      )}

      <Table
        title={
          <Box display="flex" alignItems="center">
            <Typography variant="h6" component="span">
              Builds
            </Typography>
            <IconButton
              size="small"
              onClick={refreshBuilds}
              disabled={refreshing || loading}
              style={{ marginLeft: '8px' }}
              title={refreshing ? 'Refreshing...' : 'Refresh builds'}
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
          setSelectedBuild(rowData as ModelsBuild);
          setDrawerOpen(true);
        }}
        emptyContent={
          <Typography variant="body1">
            No builds found for this component.
          </Typography>
        }
      />

      <BuildLogs
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        build={selectedBuild}
      />
    </Box>
  );
};
