import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PublicIcon from '@material-ui/icons/Public';
import VpnLockIcon from '@material-ui/icons/VpnLock';
import DeviceHubIcon from '@material-ui/icons/DeviceHub';
import {
  Card,
  lightTokens,
  darkTokens,
} from '@openchoreo/backstage-design-system';

const useStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px !important',
    border: `1px solid ${
      theme.palette.type === 'dark' ? darkTokens.border.subtle : lightTokens.grey[100]
    } !important`,
    boxShadow: `${
      theme.palette.type === 'dark' ? darkTokens.shadow.card : lightTokens.shadow.card
    } !important`,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  topologyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(2),
  },
  panelItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
  panelIcon: {
    fontSize: '1.5rem',
    marginTop: 2,
    flexShrink: 0,
  },
  externalIcon: {
    color: theme.palette.primary.main,
  },
  internalIcon: {
    color: theme.palette.text.secondary,
  },
  panelContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  panelTitle: {
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 600,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1),
  },
  protocolLabel: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    '&:first-child': {
      marginTop: 0,
    },
  },
  valueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.25, 0),
  },
  valueLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    minWidth: 36,
  },
  valueText: {
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  notConfigured: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.disabled,
    fontStyle: 'italic',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    flex: 1,
  },
  emptyIcon: {
    fontSize: '3rem',
    color: theme.palette.action.disabled,
    marginBottom: theme.spacing(2),
  },
}));

interface ListenerSpec {
  host?: string;
  port?: number;
}

interface EndpointSpec {
  name?: string;
  namespace?: string;
  http?: ListenerSpec;
  https?: ListenerSpec;
}

interface NetworkSpec {
  external?: EndpointSpec;
  internal?: EndpointSpec;
}

export interface GatewayConfigurationCardProps {
  gateway?: {
    ingress?: NetworkSpec;
  };
  title?: string;
}

const ListenerRows = ({
  listener,
  classes,
}: {
  listener: ListenerSpec;
  classes: ReturnType<typeof useStyles>;
}) => (
  <>
    {listener.host && (
      <Box className={classes.valueRow}>
        <Typography className={classes.valueLabel}>Host</Typography>
        <Typography className={classes.valueText}>{listener.host}</Typography>
      </Box>
    )}
    {listener.port !== undefined && (
      <Box className={classes.valueRow}>
        <Typography className={classes.valueLabel}>Port</Typography>
        <Typography className={classes.valueText}>{listener.port}</Typography>
      </Box>
    )}
  </>
);

export const GatewayConfigurationCard = ({
  gateway,
  title = 'Gateway Configuration',
}: GatewayConfigurationCardProps) => {
  const classes = useStyles();
  const ingress = gateway?.ingress;

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">{title}</Typography>
      </Box>

      {!ingress ? (
        <Box className={classes.emptyState}>
          <DeviceHubIcon className={classes.emptyIcon} />
          <Typography variant="body2">Gateway not configured</Typography>
        </Box>
      ) : (
        <Box className={classes.topologyGrid}>
          {/* External Panel */}
          <Box className={classes.panelItem}>
            <PublicIcon
              className={`${classes.panelIcon} ${classes.externalIcon}`}
            />
            <Box className={classes.panelContent}>
              <Typography className={classes.panelTitle}>External</Typography>

              {ingress.external?.name && (
                <Box className={classes.valueRow}>
                  <Typography className={classes.valueLabel}>Name</Typography>
                  <Typography className={classes.valueText}>
                    {ingress.external.name}
                  </Typography>
                </Box>
              )}
              {ingress.external?.namespace && (
                <Box className={classes.valueRow}>
                  <Typography className={classes.valueLabel}>
                    Namespace
                  </Typography>
                  <Typography className={classes.valueText}>
                    {ingress.external.namespace}
                  </Typography>
                </Box>
              )}

              <Typography className={classes.protocolLabel}>HTTP</Typography>
              {ingress.external?.http ? (
                <ListenerRows
                  listener={ingress.external.http}
                  classes={classes}
                />
              ) : (
                <Typography className={classes.notConfigured}>
                  Not configured
                </Typography>
              )}

              <Typography className={classes.protocolLabel}>HTTPS</Typography>
              {ingress.external?.https ? (
                <ListenerRows
                  listener={ingress.external.https}
                  classes={classes}
                />
              ) : (
                <Typography className={classes.notConfigured}>
                  Not configured
                </Typography>
              )}
            </Box>
          </Box>

          {/* Internal Panel */}
          <Box className={classes.panelItem}>
            <VpnLockIcon
              className={`${classes.panelIcon} ${classes.internalIcon}`}
            />
            <Box className={classes.panelContent}>
              <Typography className={classes.panelTitle}>Internal</Typography>

              {ingress.internal?.name && (
                <Box className={classes.valueRow}>
                  <Typography className={classes.valueLabel}>Name</Typography>
                  <Typography className={classes.valueText}>
                    {ingress.internal.name}
                  </Typography>
                </Box>
              )}
              {ingress.internal?.namespace && (
                <Box className={classes.valueRow}>
                  <Typography className={classes.valueLabel}>
                    Namespace
                  </Typography>
                  <Typography className={classes.valueText}>
                    {ingress.internal.namespace}
                  </Typography>
                </Box>
              )}

              <Typography className={classes.protocolLabel}>HTTP</Typography>
              {ingress.internal?.http ? (
                <ListenerRows
                  listener={ingress.internal.http}
                  classes={classes}
                />
              ) : (
                <Typography className={classes.notConfigured}>
                  Not configured
                </Typography>
              )}

              <Typography className={classes.protocolLabel}>HTTPS</Typography>
              {ingress.internal?.https ? (
                <ListenerRows
                  listener={ingress.internal.https}
                  classes={classes}
                />
              ) : (
                <Typography className={classes.notConfigured}>
                  Not configured
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </Card>
  );
};
