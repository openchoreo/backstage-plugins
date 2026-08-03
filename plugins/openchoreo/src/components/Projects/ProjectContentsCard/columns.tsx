import { Link, TableColumn } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';
import { Box, Tooltip, Typography } from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import LockIcon from '@material-ui/icons/LockOutlined';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { isMarkedForDeletion, DeletionBadge } from '../../DeleteEntity';
import { isForbiddenError } from '../../../utils/errorUtils';
import { type Environment, type ProjectContentItem } from '../hooks';
import { KindCell } from './KindCell';
import { DeploymentStatusCell } from './DeploymentStatusCell';
import { useProjectContentsCardStyles } from './styles';

const NameCell = ({ item }: { item: ProjectContentItem }) => {
  const app = useApp();
  const Icon = app.getSystemIcon(`kind:${item.kind}`);
  const ns = item.entity.metadata.namespace || 'default';

  return (
    <Box display="flex" alignItems="center" gridGap={6} minWidth={0}>
      {Icon && <Icon fontSize="small" />}
      {isMarkedForDeletion(item.entity) ? (
        <Box
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          gridGap={6}
          minWidth={0}
        >
          <Typography variant="body2" color="textSecondary">
            {item.displayName}
          </Typography>
          <DeletionBadge />
        </Box>
      ) : (
        <Link to={`/catalog/${ns}/${item.kind}/${item.name}`}>
          {item.displayName}
        </Link>
      )}
    </Box>
  );
};

const DeploymentStatusSkeleton = () => {
  const classes = useProjectContentsCardStyles();
  return (
    <Box className={classes.deploymentStatus}>
      {[0, 1, 2].map(index => (
        <Skeleton
          key={index}
          variant="rect"
          width={84}
          height={22}
          className={classes.skeletonChip}
        />
      ))}
    </Box>
  );
};

const DeploymentColumnCell = ({
  item,
  environments,
  canViewBindings,
  pipelineError,
  environmentsLoading,
}: {
  item: ProjectContentItem;
  environments: Environment[];
  canViewBindings: boolean;
  pipelineError: unknown;
  environmentsLoading: boolean;
}) => {
  const classes = useProjectContentsCardStyles();

  // Rows render from catalog data first; show a skeleton until the pipeline
  // environments and this row's release bindings have loaded.
  if (environmentsLoading || !item.deploymentLoaded) {
    return <DeploymentStatusSkeleton />;
  }

  if (isForbiddenError(pipelineError) || !canViewBindings) {
    return (
      <Tooltip title="You do not have permission to view release bindings. Contact your administrator for access.">
        <Box display="flex" alignItems="center" gridGap={4}>
          <LockIcon className={classes.statusIconDefault} fontSize="small" />
          <Typography variant="body2" color="textSecondary">
            Insufficient Permissions
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  return (
    <DeploymentStatusCell
      deploymentStatus={item.deploymentStatus}
      environments={environments}
    />
  );
};

const CreatedCell = ({ item }: { item: ProjectContentItem }) => {
  if (!item.createdAt) {
    return (
      <Typography variant="body2" color="textSecondary">
        —
      </Typography>
    );
  }
  return (
    <Tooltip title={new Date(item.createdAt).toLocaleString()}>
      <Typography variant="body2">
        {formatRelativeTime(item.createdAt)}
      </Typography>
    </Tooltip>
  );
};

interface BuildColumnsArgs {
  environments: Environment[];
  canViewBindings: boolean;
  pipelineError: unknown;
  /** Pipeline environments / permission still loading — skeleton the column. */
  environmentsLoading: boolean;
}

export function buildProjectContentColumns({
  environments,
  canViewBindings,
  pipelineError,
  environmentsLoading,
}: BuildColumnsArgs): TableColumn<ProjectContentItem>[] {
  return [
    {
      title: 'Name',
      field: 'displayName',
      width: '16%',
      highlight: true,
      // Ordering is server-side (see onOrderChange); the no-op keeps the
      // clickable header + arrow without reordering the current page locally.
      customSort: () => 0,
      render: item => <NameCell item={item} />,
    },
    {
      title: 'Kind',
      field: 'kind',
      width: '9%',
      render: item => <KindCell kind={item.kind} />,
    },
    {
      title: 'Description',
      field: 'description',
      width: '18%',
      cellStyle: {
        maxWidth: 220,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      render: item => (
        <Typography variant="body2" noWrap title={item.description}>
          {item.description || '—'}
        </Typography>
      ),
    },
    {
      title: 'Type',
      field: 'type',
      width: '14%',
      render: item => (
        <Typography variant="body2">{item.type || '—'}</Typography>
      ),
    },
    {
      title: 'Deployment',
      width: '30%',
      sorting: false,
      render: item => (
        <DeploymentColumnCell
          item={item}
          environments={environments}
          canViewBindings={canViewBindings}
          pipelineError={pipelineError}
          environmentsLoading={environmentsLoading}
        />
      ),
    },
    {
      title: 'Created',
      field: 'createdAt',
      width: '13%',
      // Default sort: newest first. Ordering is server-side (see onOrderChange).
      defaultSort: 'desc',
      customSort: () => 0,
      render: item => <CreatedCell item={item} />,
    },
  ];
}
