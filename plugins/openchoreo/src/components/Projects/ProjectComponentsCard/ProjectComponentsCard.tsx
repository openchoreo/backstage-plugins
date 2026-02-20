import { useMemo } from 'react';
import { Link, Table, TableColumn } from '@backstage/core-components';
import { Box, Button, Typography } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import { useNavigate } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useComponentsWithDeployment,
  useEnvironments,
  useDeploymentPipeline,
  ComponentWithDeployment,
  type Environment,
} from '../hooks';
import { DeploymentStatusCell } from './DeploymentStatusCell';
import { BuildStatusCell } from './BuildStatusCell';
import { useProjectComponentsCardStyles } from './styles';

export const ProjectComponentsCard = () => {
  const classes = useProjectComponentsCardStyles();
  const { entity } = useEntity();
  const { components, loading } = useComponentsWithDeployment(entity);
  const { environments, loading: envsLoading } = useEnvironments(entity);
  const { data: pipelineData, loading: pipelineLoading } =
    useDeploymentPipeline();
  const navigate = useNavigate();

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
      width: '25%',
      highlight: true,
      render: (component: ComponentWithDeployment) => (
        <Link
          to={`/catalog/${
            component.metadata.namespace || 'default'
          }/component/${component.metadata.name}`}
        >
          {component.metadata.title || component.metadata.name}
        </Link>
      ),
    },
    {
      title: 'Type',
      field: 'spec.type',
      width: '15%',
      render: (component: ComponentWithDeployment) => (
        <Typography variant="body2">
          {String(component.spec?.type || '-')}
        </Typography>
      ),
    },
    {
      title: 'Description',
      field: 'metadata.description',
      width: '18%',
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
      title: 'Latest Build',
      width: '15%',
      render: (component: ComponentWithDeployment) => (
        <BuildStatusCell component={component} />
      ),
    },
    {
      title: 'Deployment',
      width: '22%',
      render: (component: ComponentWithDeployment) => (
        <DeploymentStatusCell
          component={component}
          environments={pipelineEnvironments}
        />
      ),
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
            onClick: () =>
              navigate(
                `/create?view=components&filters[type]=component&project=${entity.metadata.name}`,
              ),
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
