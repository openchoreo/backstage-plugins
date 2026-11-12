import type { ReactNode } from 'react';
import { Box, LinearProgress, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { EntityRefLink } from '@backstage/plugin-catalog-react';

const useStyles = makeStyles(theme => ({
  backend: {
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  backendHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  backendActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  share: {
    marginTop: theme.spacing(0.5),
    height: 6,
    borderRadius: 3,
  },
}));

/** One backend as ingested onto the Endpoint entity's spec.backends. */
export interface EndpointBackend {
  name: string;
  kind?: string;
  component?: string;
  endpoint?: string;
  weight?: number;
}

/**
 * Share of traffic each backend receives. A backend without a weight counts
 * as 1, the CRD default, and a total of 0 sends nothing anywhere.
 */
export function trafficShares(backends: EndpointBackend[]): number[] {
  const weights = backends.map(b => b.weight ?? 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map(w => (total > 0 ? (w / total) * 100 : 0));
}

function formatShare(share: number): string {
  return Number.isInteger(share) ? `${share}%` : `${share.toFixed(1)}%`;
}

/**
 * An Endpoint's backends with the share of traffic each receives. Read-only
 * unless `renderActions` adds controls to each row.
 */
export const EndpointBackendList = ({
  backends,
  namespace,
  renderActions,
}: {
  backends: EndpointBackend[];
  namespace: string;
  renderActions?: (backend: EndpointBackend) => ReactNode;
}) => {
  const classes = useStyles();
  const shares = trafficShares(backends);
  return (
    <>
      {backends.map((backend, i) => (
        <Box key={backend.name} className={classes.backend}>
          <Box className={classes.backendHeader}>
            <Typography variant="body2" component="div">
              {backend.component ? (
                <EntityRefLink
                  entityRef={{
                    kind: 'component',
                    namespace,
                    name: backend.component,
                  }}
                />
              ) : (
                backend.name
              )}
              {backend.endpoint && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  component="span"
                >
                  {` / ${backend.endpoint}`}
                </Typography>
              )}
            </Typography>
            <Box className={classes.backendActions}>
              <Typography variant="body2" color="textSecondary">
                {formatShare(shares[i])}
              </Typography>
              {renderActions?.(backend)}
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={shares[i]}
            className={classes.share}
            aria-label={`${backend.name} traffic share`}
          />
        </Box>
      ))}
    </>
  );
};
