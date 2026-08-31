import { useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { InfoCard } from '@backstage/core-components';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { catalogApiRef, EntityRefLink } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '@openchoreo/backstage-plugin';
import { getNodeColor } from '@openchoreo/backstage-plugin-react';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Typography,
  Button,
  Collapse,
  Box,
  Tooltip,
} from '@material-ui/core';
import { makeStyles, useTheme, Theme } from '@material-ui/core/styles';
import Skeleton from '@material-ui/lab/Skeleton';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { getRelativeTime } from './relativeTime';

const NUM_DEPLOYMENTS_OPEN = 4;
const NUM_DEPLOYMENTS_TOTAL = 8;
/** Upper bound on the per-component environment-info fan-out. */
const MAX_COMPONENTS = 20;

/** Environment entry shape returned by fetchEnvironmentInfo (see
 *  useEnvironmentData in @openchoreo/backstage-plugin). */
interface EnvironmentInfo {
  name: string;
  deployment: {
    status?: 'Ready' | 'NotReady' | 'Failed';
    statusMessage?: string;
    lastDeployed?: string;
    image?: string;
    releaseName?: string;
  };
}

interface EnvDeployment {
  name: string;
  status?: 'Ready' | 'NotReady' | 'Failed';
  statusMessage?: string;
  lastDeployed: number;
}

/** One row per component; all deployed environments collapse into it. */
interface DeploymentRow {
  entityRef: string;
  /** Component type (entity spec.type), e.g. 'service', 'api-proxy'. */
  componentType?: string;
  /** Deployed environments, most recent first. */
  environments: EnvDeployment[];
  /** Most recent lastDeployed across the environments. */
  latestDeployed: number;
}

/** Worst-of aggregate across a row's environments: Failed > NotReady > Ready. */
function aggregateStatus(
  environments: EnvDeployment[],
): EnvDeployment['status'] {
  if (environments.some(env => env.status === 'Failed')) return 'Failed';
  if (environments.some(env => env.status === 'NotReady')) return 'NotReady';
  if (environments.some(env => env.status === 'Ready')) return 'Ready';
  return undefined;
}

const useStyles = makeStyles(theme => ({
  chip: {
    color: theme.palette.common.white,
    fontWeight: 'bold',
    margin: 0,
    marginRight: theme.spacing(1),
    minWidth: 90,
    justifyContent: 'center',
  },
  listItem: {
    paddingTop: theme.spacing(0.75),
    paddingBottom: theme.spacing(0.75),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    flex: 1,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    flexShrink: 0,
    marginRight: theme.spacing(1.5),
  },
  name: {
    fontSize: theme.typography.body1.fontSize,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 140,
    marginRight: theme.spacing(2),
    flexShrink: 0,
  },
  timestamp: {
    marginLeft: 'auto',
    paddingLeft: theme.spacing(1),
    flexShrink: 0,
  },
  trailingIcon: {
    color: theme.palette.text.secondary,
    opacity: 0.6,
    marginLeft: theme.spacing(0.5),
    flexShrink: 0,
  },
  skeleton: {
    borderRadius: 30,
  },
}));

function statusColor(status: EnvDeployment['status'], theme: Theme): string {
  switch (status) {
    case 'Ready':
      return theme.palette.success.main;
    case 'NotReady':
      return theme.palette.warning.main;
    case 'Failed':
      return theme.palette.error.main;
    default:
      return theme.palette.text.disabled;
  }
}

const DeploymentItem = ({ row }: { row: DeploymentRow }) => {
  const classes = useStyles();
  const theme = useTheme();
  const tokens = useChoreoTokens();
  const rowStatus = aggregateStatus(row.environments);

  return (
    <ListItem disableGutters className={classes.listItem}>
      <Box className={classes.row}>
        <Tooltip title={rowStatus ?? 'Unknown status'}>
          <Box
            component="span"
            className={classes.statusDot}
            style={{ backgroundColor: statusColor(rowStatus, theme) }}
          />
        </Tooltip>
        <EntityRefLink
          entityRef={row.entityRef}
          className={classes.name}
          hideIcon
          disableTooltip
        />
        <Chip
          size="small"
          className={classes.chip}
          label={row.componentType ?? 'component'}
          style={{ background: getNodeColor('component', tokens) }}
        />
        {row.environments.map(env => (
          <Tooltip
            key={env.name}
            title={`${
              env.statusMessage ?? env.status ?? 'Unknown'
            } — deployed ${getRelativeTime(env.lastDeployed)}`}
          >
            {/* Env chips are colored by their own deployment status. */}
            <Chip
              size="small"
              className={classes.chip}
              label={env.name}
              style={{ background: statusColor(env.status, theme) }}
            />
          </Tooltip>
        ))}
        <Typography
          component="time"
          variant="caption"
          color="textSecondary"
          className={classes.timestamp}
        >
          deployed {getRelativeTime(row.latestDeployed)}
        </Typography>
        <ChevronRightIcon fontSize="small" className={classes.trailingIcon} />
      </Box>
    </ListItem>
  );
};

const DeploymentItemSkeleton = () => {
  const classes = useStyles();
  return (
    <ListItem disableGutters className={classes.listItem}>
      <ListItemAvatar>
        <Skeleton
          className={classes.skeleton}
          variant="rect"
          width={50}
          height={24}
        />
      </ListItemAvatar>
      <ListItemText
        primary={<Skeleton variant="text" width="100%" height={28} />}
        disableTypography
      />
    </ListItem>
  );
};

/**
 * Home page card listing the most recent deployments across the user's
 * components — "what just shipped". Built from the catalog Component list
 * plus per-component environment info; the fan-out is capped at
 * MAX_COMPONENTS to keep the landing page cheap.
 */
export const RecentDeploymentsCard = () => {
  const catalogApi = useApi(catalogApiRef);
  const client = useApi(openChoreoClientApiRef);
  const [collapsed, setCollapsed] = useState(true);

  const {
    value: rows = [],
    loading,
    error,
  } = useAsync(async () => {
    // Bounded, deterministic fetch: newest components first. The catalog has
    // no "last deployed" field, so created-at is the best server-side proxy
    // for which components are worth the environment-info fan-out; true
    // recency ordering would need a backend endpoint listing recent releases.
    const { items: components } = await catalogApi.queryEntities({
      filter: { kind: 'Component' },
      limit: MAX_COMPONENTS,
      orderFields: [
        {
          field: `metadata.annotations.${CHOREO_ANNOTATIONS.CREATED_AT}`,
          order: 'desc',
        },
      ],
      fields: [
        'kind',
        'metadata.name',
        'metadata.namespace',
        'metadata.title',
        'metadata.annotations',
        'spec.type',
      ],
    });

    const results = await Promise.allSettled(
      components.map(async (entity): Promise<DeploymentRow | null> => {
        const environments = (await client.fetchEnvironmentInfo(
          entity as Entity,
        )) as EnvironmentInfo[];

        const envDeployments = (environments ?? [])
          .filter(env => env.deployment?.lastDeployed)
          .map<EnvDeployment>(env => ({
            name: env.name,
            status: env.deployment.status,
            statusMessage: env.deployment.statusMessage,
            lastDeployed: Date.parse(env.deployment.lastDeployed!),
          }))
          .filter(env => !Number.isNaN(env.lastDeployed))
          .sort((a, b) => b.lastDeployed - a.lastDeployed);

        if (envDeployments.length === 0) {
          return null;
        }
        // spec.type is `<workloadType>/<componentType>` (e.g. `proxy/api-proxy`,
        // `deployment/service`) — the chip shows just the component type.
        const rawType =
          typeof entity.spec?.type === 'string' ? entity.spec.type : undefined;
        return {
          entityRef: stringifyEntityRef(entity),
          componentType: rawType?.split('/').pop() || undefined,
          environments: envDeployments,
          latestDeployed: envDeployments[0].lastDeployed,
        };
      }),
    );

    return results
      .flatMap(result =>
        result.status === 'fulfilled' && result.value ? [result.value] : [],
      )
      .sort((a, b) => b.latestDeployed - a.latestDeployed)
      .slice(0, NUM_DEPLOYMENTS_TOTAL);
  }, [catalogApi, client]);

  const showToggle = !loading && rows.length > NUM_DEPLOYMENTS_OPEN;

  let body;
  if (loading) {
    body = (
      <>
        {Array.from({ length: NUM_DEPLOYMENTS_OPEN }, (_, i) => (
          <DeploymentItemSkeleton key={i} />
        ))}
      </>
    );
  } else if (error || rows.length === 0) {
    body = (
      <>
        <Typography variant="body2" color="textSecondary">
          No recent deployments.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Deployments across your components will show up here as they ship.
        </Typography>
      </>
    );
  } else {
    body = (
      <>
        {rows.slice(0, NUM_DEPLOYMENTS_OPEN).map((row, i) => (
          <DeploymentItem row={row} key={i} />
        ))}
        {rows.length > NUM_DEPLOYMENTS_OPEN && (
          <Collapse in={!collapsed}>
            {rows.slice(NUM_DEPLOYMENTS_OPEN).map((row, i) => (
              <DeploymentItem row={row} key={i} />
            ))}
          </Collapse>
        )}
      </>
    );
  }

  return (
    <InfoCard
      title="Recent Deployments"
      subheader="Latest releases across your components"
      actions={
        showToggle ? (
          <Button variant="text" onClick={() => setCollapsed(prev => !prev)}>
            {collapsed ? 'View more' : 'View less'}
          </Button>
        ) : undefined
      }
    >
      <List dense disablePadding>
        {body}
      </List>
    </InfoCard>
  );
};
