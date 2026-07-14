import { Link, Table, TableColumn } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';
import { Entity, RELATION_HAS_PART } from '@backstage/catalog-model';
import { useEntity, useRelatedEntities } from '@backstage/plugin-catalog-react';
import { Box, Button, Tooltip, Typography } from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import AddIcon from '@material-ui/icons/Add';
import { useNavigate } from 'react-router-dom';
import { isMarkedForDeletion, DeletionBadge } from '../../DeleteEntity';
import { useScopedProjectCreatePermission } from '@openchoreo/backstage-plugin-react';
import { shouldNavigateOnRowClick } from '../../../utils/shouldNavigateOnRowClick';
import { useNamespaceProjectsCardStyles } from './styles';

export const NamespaceProjectsCard = () => {
  const app = useApp();
  const Icon = app.getSystemIcon('kind:system');
  const classes = useNamespaceProjectsCardStyles();
  const { entity } = useEntity();
  const { entities: systems, loading } = useRelatedEntities(entity, {
    type: RELATION_HAS_PART,
    kind: 'System',
  });
  const {
    canCreate,
    loading: permLoading,
    createDeniedTooltip,
  } = useScopedProjectCreatePermission();
  const navigate = useNavigate();

  const columns: TableColumn<Entity>[] = [
    {
      title: 'Name',
      field: 'metadata.name',
      highlight: true,
      render: (row: Entity) => {
        const name = row.metadata.title || row.metadata.name;
        return (
          <Box display="flex" alignItems="center" gridGap={6}>
            {Icon && <Icon fontSize="small" />}
            {isMarkedForDeletion(row) ? (
              <>
                <Typography variant="body2" color="textSecondary">
                  {name}
                </Typography>
                <DeletionBadge />
              </>
            ) : (
              <Link
                to={`/catalog/${row.metadata.namespace || 'default'}/system/${
                  row.metadata.name
                }`}
              >
                {name}
              </Link>
            )}
          </Box>
        );
      },
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
        title="Has Projects"
        columns={loading ? skeletonColumns : columns}
        data={loading ? skeletonRows : systems || []}
        isLoading={false}
        onRowClick={(event, rowData) => {
          if (
            loading ||
            !rowData ||
            !shouldNavigateOnRowClick(event) ||
            isMarkedForDeletion(rowData)
          )
            return;
          const ns = rowData.metadata.namespace || 'default';
          navigate(`/catalog/${ns}/system/${rowData.metadata.name}`);
        }}
        emptyContent={
          <Box p={3}>
            <Typography variant="body1" color="textSecondary" align="center">
              No projects found in this namespace
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
        actions={[
          {
            icon: AddIcon,
            tooltip: 'Create a new project',
            isFreeAction: true,
            onClick: () =>
              navigate(
                `/create?view=projects&namespace=${entity.metadata.name}`,
              ),
          },
        ]}
        components={{
          Action: ({ action }: any) => (
            <Tooltip title={createDeniedTooltip}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon />}
                  className={classes.createProjectButton}
                  disabled={!canCreate || permLoading}
                  onClick={(event: React.MouseEvent) =>
                    action.onClick(event, undefined)
                  }
                >
                  Create Project
                </Button>
              </span>
            </Tooltip>
          ),
        }}
      />
    </Box>
  );
};
