import { Link, Table, TableColumn } from '@backstage/core-components';
import { Entity, RELATION_HAS_PART } from '@backstage/catalog-model';
import { useEntity, useRelatedEntities } from '@backstage/plugin-catalog-react';
import { Box, Typography } from '@material-ui/core';
import { useNamespaceResourcesCardStyles } from './styles';

const kindDisplayNames: Record<string, string> = {
  resource: 'Resource',
  component: 'Component',
  api: 'API',
};

function getKindDisplayName(kind: string): string {
  return kindDisplayNames[kind.toLowerCase()] || kind;
}

const columns: TableColumn<Entity>[] = [
  {
    title: 'Name',
    field: 'metadata.name',
    highlight: true,
    render: (entity: Entity) => (
      <Link
        to={`/catalog/${
          entity.metadata.namespace || 'default'
        }/${entity.kind.toLowerCase()}/${entity.metadata.name}`}
      >
        {entity.metadata.title || entity.metadata.name}
      </Link>
    ),
  },
  {
    title: 'Kind',
    field: 'kind',
    render: (entity: Entity) => (
      <Typography variant="body2">{getKindDisplayName(entity.kind)}</Typography>
    ),
  },
  {
    title: 'Description',
    field: 'metadata.description',
    render: (entity: Entity) => (
      <Typography variant="body2">
        {entity.metadata.description || '-'}
      </Typography>
    ),
  },
];

export const NamespaceResourcesCard = () => {
  const classes = useNamespaceResourcesCardStyles();
  const { entity } = useEntity();
  const { entities, loading } = useRelatedEntities(entity, {
    type: RELATION_HAS_PART,
  });

  const resources = (entities || []).filter(
    e => e.kind.toLowerCase() !== 'system',
  );

  return (
    <Box className={classes.cardWrapper}>
      <Table
        title={`All Resources in ${entity.metadata.namespace} Namespace`}
        columns={columns}
        data={resources}
        isLoading={loading}
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
