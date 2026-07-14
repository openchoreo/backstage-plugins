import { Link, Table, TableColumn } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';
import { Entity, RELATION_HAS_PART } from '@backstage/catalog-model';
import { useEntity, useRelatedEntities } from '@backstage/plugin-catalog-react';
import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { useNavigate } from 'react-router-dom';
import { shouldNavigateOnRowClick } from '../../../utils/shouldNavigateOnRowClick';
import { useNamespaceResourcesCardStyles } from './styles';

const kindDisplayNames: Record<string, string> = {
  resource: 'Resource',
  component: 'Component',
  api: 'API',
};

function getKindDisplayName(kind: string): string {
  return kindDisplayNames[kind.toLowerCase()] || kind;
}

export const NamespaceResourcesCard = () => {
  const app = useApp();
  const classes = useNamespaceResourcesCardStyles();
  const { entity } = useEntity();
  const navigate = useNavigate();
  const { entities, loading } = useRelatedEntities(entity, {
    type: RELATION_HAS_PART,
  });

  const resources = (entities || []).filter(
    e => e.kind.toLowerCase() !== 'system',
  );

  const columns: TableColumn<Entity>[] = [
    {
      title: 'Name',
      field: 'metadata.name',
      highlight: true,
      render: (row: Entity) => {
        const Icon = app.getSystemIcon(`kind:${row.kind.toLowerCase()}`);
        return (
          <Box display="flex" alignItems="center" gridGap={6}>
            {Icon && <Icon fontSize="small" />}
            <Link
              to={`/catalog/${
                row.metadata.namespace || 'default'
              }/${row.kind.toLowerCase()}/${row.metadata.name}`}
            >
              {row.metadata.title || row.metadata.name}
            </Link>
          </Box>
        );
      },
    },
    {
      title: 'Kind',
      field: 'kind',
      render: (row: Entity) => (
        <Typography variant="body2">{getKindDisplayName(row.kind)}</Typography>
      ),
    },
    {
      title: 'Description',
      field: 'metadata.description',
      render: (row: Entity) => (
        <Typography variant="body2">
          {row.metadata.description || '-'}
        </Typography>
      ),
    },
  ];

  // While loading, render skeleton rows on the card's paper background instead
  // of the Table's built-in CircularProgress overlay (which sits on the grey
  // page background). Cloned columns keep the header row + layout stable.
  const skeletonColumns: TableColumn<Entity>[] = columns.map(column => ({
    ...column,
    sorting: false,
    render: () => <Skeleton variant="text" height={20} />,
  }));
  const skeletonRows = Array.from(
    { length: 3 },
    (_, index) =>
      ({ metadata: { name: `skeleton-${index}` } } as unknown as Entity),
  );

  return (
    <Box className={classes.cardWrapper}>
      <Table
        title="Other Resources in Namespace"
        columns={loading ? skeletonColumns : columns}
        data={loading ? skeletonRows : resources}
        isLoading={false}
        onRowClick={(event, rowData) => {
          if (loading || !rowData || !shouldNavigateOnRowClick(event)) return;
          const ns = rowData.metadata.namespace || 'default';
          navigate(
            `/catalog/${ns}/${rowData.kind.toLowerCase()}/${
              rowData.metadata.name
            }`,
          );
        }}
        emptyContent={
          <Box p={3}>
            <Typography variant="body1" color="textSecondary" align="center">
              No resources found in this namespace
            </Typography>
          </Box>
        }
        options={{
          paging: true,
          pageSize: 5,
          pageSizeOptions: [5, 10, 20],
          search: true,
          actionsColumnIndex: -1,
          padding: 'dense',
          draggable: false,
        }}
        style={{ minWidth: 0, width: '100%', height: 'calc(100% - 10px)' }}
      />
    </Box>
  );
};
