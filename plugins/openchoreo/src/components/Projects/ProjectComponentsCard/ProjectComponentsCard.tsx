import { useMemo } from 'react';
import { Link, Table, TableColumn } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';
import { Box, Button, Typography } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import LockIcon from '@material-ui/icons/LockOutlined';
import { isForbiddenError } from '../../../utils/errorUtils';
import { useNavigate } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useCreateComponentPath } from '@openchoreo/backstage-plugin-react';
import {
  useComponentsWithDeployment,
  useEnvironments,
  useDeploymentPipeline,
  ComponentWithDeployment,
  type Environment,
} from '../hooks';
import { shouldNavigateOnRowClick } from '../../../utils/shouldNavigateOnRowClick';
import { DeploymentStatusCell } from './DeploymentStatusCell';
import { BuildStatusCell } from './BuildStatusCell';
import { useProjectComponentsCardStyles } from './styles';

export const ProjectComponentsCard = () => {
  const app = useApp();
  const classes = useProjectComponentsCardStyles();
  const { entity } = useEntity();
  const { components, loading } = useComponentsWithDeployment(entity);
  const { environments, loading: envsLoading } = useEnvironments(entity);
  const {
    data: pipelineData,
    loading: pipelineLoading,
    error: pipelineError,
  } = useDeploymentPipeline();
  const navigate = useNavigate();
  const { path: createComponentPath, loading: createPathLoading } =
    useCreateComponentPath(entity);

  // Filter and sort environments based on deployment pipeline
  const pipelineEnvironments = useMemo(() => {
    if (!pipelineData?.environments || !environments.length) {
      return [];
    }

    // Get environment names from pipeline in order
    const pipelineEnvNames = pipelineData.environments;

    // Filter catalog environments to only those in pipeline, maintaining pipeline order
    return pipelineEnvNames
      .map(envName =>
        environments.find(
          env => env.name.toLowerCase() === envName.toLowerCase(),
        ),
      )
      .filter((env): env is Environment => env !== undefined);
  }, [pipelineData, environments]);

  const columns: TableColumn<ComponentWithDeployment>[] = [
    {
      title: 'Name',
      field: 'metadata.name',
      width: '20%',
      highlight: true,
      render: (component: ComponentWithDeployment) => {
        const Icon = app.getSystemIcon('kind:component');
        return (
          <Box display="flex" alignItems="center" gridGap={6}>
            {Icon && <Icon fontSize="small" />}
            <Link
              to={`/catalog/${
                component.metadata.namespace || 'default'
              }/component/${component.metadata.name}`}
            >
              {component.metadata.title || component.metadata.name}
            </Link>
          </Box>
        );
      },
    },
    {
      title: 'Type',
      field: 'spec.type',
      width: '10%',
      render: (component: ComponentWithDeployment) => (
        <Typography variant="body2">
          {String(component.spec?.type || '-')}
        </Typography>
      ),
    },
    {
      title: 'Description',
      field: 'metadata.description',
      width: '15%',
      render: (component: ComponentWithDeployment) => (
        <Typography
          variant="body2"
          noWrap
          title={component.metadata.description || ''}
        >
          {component.metadata.description || '-'}
        </Typography>
      ),
    },
    {
      title: 'Build',
      width: '5%',
      render: (component: ComponentWithDeployment) => (
        <BuildStatusCell component={component} />
      ),
    },
    {
      title: 'Deployment',
      width: '40%',
      render: (component: ComponentWithDeployment) => {
        if (isForbiddenError(pipelineError)) {
          return (
            <Box display="flex" alignItems="center" gridGap={4}>
              <LockIcon style={{ fontSize: 16, color: '#999' }} />
              <Typography variant="body2" color="textSecondary">
                Insufficient permissions
              </Typography>
            </Box>
          );
        }
        return (
          <DeploymentStatusCell
            component={component}
            environments={pipelineEnvironments}
          />
        );
      },
    },
  ];

  if (loading || envsLoading || pipelineLoading) {
    return (
      <Box p={3}>
        <Typography variant="body1" color="textSecondary" align="center">
          Loading...
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.cardWrapper}>
      <Table
        title="Has Components"
        columns={columns}
        data={components}
        onRowClick={(event, rowData) => {
          if (!rowData || !shouldNavigateOnRowClick(event)) return;
          const ns = rowData.metadata.namespace || 'default';
          navigate(`/catalog/${ns}/component/${rowData.metadata.name}`);
        }}
        emptyContent={
          <Box p={3}>
            <Typography variant="body1" color="textSecondary" align="center">
              No components found in this project
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
            tooltip: 'Create a new component',
            isFreeAction: true,
            onClick: () => !createPathLoading && navigate(createComponentPath),
          },
        ]}
        components={{
          Action: ({ action }: any) => (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              className={classes.createComponentButton}
              onClick={(event: React.MouseEvent) =>
                action.onClick(event, undefined)
              }
            >
              Create Component
            </Button>
          ),
        }}
      />
    </Box>
  );
};
