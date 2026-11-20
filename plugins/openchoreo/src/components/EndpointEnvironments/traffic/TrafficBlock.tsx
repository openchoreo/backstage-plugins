import { Box, Button, Tooltip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useNavigate } from 'react-router-dom';
import { useEndpointReleaseBindingUpdatePermission } from '@openchoreo/backstage-plugin-react';
import {
  describeMatch,
  inMatchOrder,
  isMirror,
  sameMatch,
  splitOf,
  type EndpointTrafficBackend,
} from '@openchoreo/backstage-plugin-common';
import type { EndpointEnvironment } from '../../../api/OpenChoreoClientApi';
import { useResourceEnvironmentDetailPanelStyles } from '../../ResourceEnvironments/styles';
import { envResourceName } from '../endpointEnvironmentUtils';
import { TrafficSplitBar, useBackendColors } from './TrafficSplitBar';
import {
  servedBackends,
  useEndpointTrafficContext,
} from './useEndpointTraffic';

const useStyles = makeStyles(theme => ({
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '8px minmax(0, 1fr) auto',
    columnGap: theme.spacing(1),
    alignItems: 'baseline',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    alignSelf: 'center',
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  value: {
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.secondary,
  },
  own: { color: theme.palette.primary.main, fontWeight: 500 },
  rule: {
    gridColumn: '2 / 4',
    color: theme.palette.text.secondary,
    overflowWrap: 'anywhere',
  },
  ownRule: { color: theme.palette.primary.main },
  faded: { opacity: 0.5 },
}));

interface Row {
  backend: EndpointTrafficBackend;
  value: string;
  valueOwn: boolean;
  valueDefault: string;
  rule?: string;
  ruleOwn: boolean;
  ruleDefault?: string;
  faded: boolean;
}

/**
 * What an environment serves: the shares as a bar, then one row for each
 * backend that gets requests here, with its share or copy on the right and
 * its condition, in full, under its name. A value that is the environment's
 * own reads in primary, with the default in its tooltip. Configure opens the
 * Traffic tab of its overrides. Shown once the release there has more than
 * one backend.
 */
export const TrafficBlock = ({ env }: { env: EndpointEnvironment }) => {
  const classes = useResourceEnvironmentDetailPanelStyles();
  const styles = useStyles();
  const navigate = useNavigate();
  const { info } = useEndpointTrafficContext();
  const envName = envResourceName(env);
  const perm = useEndpointReleaseBindingUpdatePermission(envName);
  const traffic = info?.environments.find(e => e.environment === envName);
  const colors = useBackendColors(info?.backends ?? [], traffic?.release ?? []);
  if (!info || !traffic || traffic.release.length < 2) return null;

  const served = servedBackends(traffic);
  const split = splitOf(served);
  const defaults = splitOf(traffic.release);
  const unresolved = (name: string) =>
    env.backends?.some(b => b.name === name && !b.resolved) ?? false;

  const rows: Row[] = served
    .filter(b =>
      isMirror(b) ? b.mirror!.percent > 0 : split[b.name] > 0 || b.match,
    )
    .map(b => {
      const release = traffic.release.find(r => r.name === b.name);
      const share = split[b.name];
      let value = share > 0 ? `${share}%` : '';
      if (isMirror(b)) value = `copy ${share}%`;
      return {
        backend: b,
        value,
        valueOwn: share !== defaults[b.name],
        valueDefault: isMirror(b)
          ? `copy ${defaults[b.name]}%`
          : `${defaults[b.name]}%`,
        rule: b.match ? `if ${describeMatch(b.match)}` : undefined,
        ruleOwn: Boolean(b.match) && !sameMatch(b.match, release?.match),
        ruleDefault: release?.match
          ? `if ${describeMatch(release.match)}`
          : undefined,
        faded: unresolved(b.name),
      };
    })
    // Shares first, then conditions, then copies, as requests are routed.
    .sort((a, b) => rank(a) - rank(b));
  // Conditions in the order they're checked.
  const ruled = rows.filter(r => r.rule && !isMirror(r.backend));
  const inOrder = inMatchOrder(ruled.map(r => r.backend));
  ruled.sort((a, b) => inOrder.indexOf(a.backend) - inOrder.indexOf(b.backend));
  rows.splice(
    rows.findIndex(r => r.rule && !isMirror(r.backend)),
    ruled.length,
    ...ruled,
  );

  const taking = served.filter(b => !isMirror(b) && split[b.name] > 0);

  return (
    <Box className={classes.section}>
      <Box className={classes.sectionTitleRow}>
        <Typography className={classes.sectionHeading}>Traffic</Typography>
        <Button
          size="small"
          color="primary"
          disabled={!perm.canUpdate || perm.loading}
          onClick={() => navigate(`overrides/${envName}?tab=traffic`)}
        >
          Configure
        </Button>
      </Box>
      {taking.length > 1 && (
        <TrafficSplitBar backends={taking} colors={colors} showLegend={false} />
      )}
      <Box className={styles.rows}>
        {rows.map(r => (
          <Box
            key={r.backend.name}
            className={`${styles.row} ${r.faded ? styles.faded : ''}`}
          >
            <span
              className={styles.dot}
              style={{ backgroundColor: colors.get(r.backend.name) }}
            />
            <Typography variant="body2" className={styles.name}>
              {r.backend.name}
            </Typography>
            <Tooltip
              title={r.valueOwn && r.value ? `Default: ${r.valueDefault}` : ''}
            >
              <Typography
                variant="body2"
                className={`${styles.value} ${
                  r.valueOwn && r.value ? styles.own : ''
                }`}
              >
                {r.value}
              </Typography>
            </Tooltip>
            {r.rule && (
              <Tooltip title={r.ruleOwn ? `Default: ${r.ruleDefault}` : ''}>
                <Typography
                  variant="caption"
                  className={`${styles.rule} ${
                    r.ruleOwn ? styles.ownRule : ''
                  }`}
                >
                  {r.rule}
                </Typography>
              </Tooltip>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

function rank(r: Row): number {
  if (isMirror(r.backend)) return 2;
  return r.rule ? 1 : 0;
}
