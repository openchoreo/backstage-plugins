import { Link, Table, TableColumn } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';
import { Entity, RELATION_HAS_PART } from '@backstage/catalog-model';
import { useEntity, useRelatedEntities } from '@backstage/plugin-catalog-react';
import { Box, Button, Tooltip, Typography } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import { useNavigate } from 'react-router-dom';
import { useProjectPermission } from '@openchoreo/backstage-plugin-react';
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
  } = useProjectPermission();
  const navigate = useNavigate();

  const columns: TableColumn<Entity>[] = [
    {
      title: 'Name',
      field: 'metadata.name',
      highlight: true,
      render: (row: Entity) => (
        <Box display="flex" alignItems="center" gridGap={6}>
          {Icon && <Icon fontSize="small" />}
          <Link
            to={`/catalog/${row.metadata.namespace || 'default'}/system/${
              row.metadata.name
            }`}
          >
            {row.metadata.title || row.metadata.name}
          </Link>
        </Box>
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

  return (
    <Box className={classes.cardWrapper}>
      <Table
        title="Has Projects"
        columns={columns}
        data={systems || []}
        isLoading={loading}
        onRowClick={(event, rowData) => {
          if (!rowData || !shouldNavigateOnRowClick(event)) return;
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
                `/create/templates/default/create-openchoreo-project?namespace=${entity.metadata.name}`,
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
