import { useState, type CSSProperties } from 'react';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import AddIcon from '@material-ui/icons/Add';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import { useNavigate } from 'react-router-dom';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import {
  MAX_ENDPOINT_BACKENDS,
  describeMatch,
  isMirror,
  splitOf,
  type EndpointTrafficBackend,
  backendLabel,
} from '@openchoreo/backstage-plugin-common';
import { useResourceDefinitionPermission } from '@openchoreo/backstage-plugin-react';
import {
  RemoveBackendDialog,
  removeProblem,
} from './traffic/RemoveBackendDialog';
import { useBackendColors } from './traffic/TrafficSplitBar';
import {
  servedBackends,
  useEndpointTrafficContext,
} from './traffic/useEndpointTraffic';
import type { EndpointBackendChange } from './useAwaitEndpointRelease';

const IN_PROGRESS = 'Wait for the new release from the last change.';

/** The rows and bars of the Endpoint overview's backend list. */
const useStyles = makeStyles(theme => ({
  backend: {
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': { borderBottom: 'none' },
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
    flexShrink: 0,
  },
  share: {
    minWidth: 0,
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.secondary,
    textTransform: 'none',
    fontWeight: 400,
  },
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  bar: {
    marginTop: theme.spacing(0.5),
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.action.hover,
  },
  fill: { borderRadius: 3, backgroundColor: 'var(--backend-color)' },
  copyFill: { opacity: 0.5 },
}));

/**
 * The Endpoint's backends on the Set up pane, each with the share of the
 * default split it gets, as a bar. A condition or a copy is a line under
 * the name. Add backend, the share and ✎ open the backend page, where the
 * shares are edited too, and 🗑 removes a backend. Each change cuts a new release:
 * `onChanged` hands the change to the pane, which shows it in progress until
 * the release is cut. Changes are disabled meanwhile (`awaiting`).
 */
export const EndpointBackendsSection = ({
  awaiting,
  onChanged,
}: {
  awaiting: boolean;
  onChanged: (change: EndpointBackendChange) => void;
}) => {
  const classes = useStyles();
  const navigate = useNavigate();
  const { entity } = useEntity();
  const {
    info,
    refetch,
    loading: trafficLoading,
    error: trafficError,
  } = useEndpointTrafficContext();
  const { canUpdate, loading, updateDeniedTooltip } =
    useResourceDefinitionPermission();
  const [removing, setRemoving] = useState<EndpointTrafficBackend | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const permitted = canUpdate && !loading;
  // A failed refresh may leave what's shown out of date, so changes wait
  // for a read that succeeds.
  const canChange = permitted && !awaiting && Boolean(info) && !trafficError;
  // Why a control is disabled, before any reason of its own.
  let blockedReason = '';
  if (!permitted) blockedReason = updateDeniedTooltip;
  else if (awaiting) blockedReason = IN_PROGRESS;
  else if (trafficError)
    blockedReason = 'Couldn’t read the backends. Retry first.';

  const namespace = entity.metadata.namespace ?? 'default';
  const backends = info?.backends ?? [];
  const shares = splitOf(backends);
  const colors = useBackendColors(backends);
  const deployed = (info?.environments ?? []).filter(e => e.endpointRelease);
  // A backend the default gives a share but no environment serves anymore,
  // such as the version a new one has taken over from everywhere. Not
  // offered while any environment's release couldn't be read, or while the
  // backends shown may be out of date.
  const retired = backends.find(
    b =>
      backends.length > 1 &&
      !trafficError &&
      !deployed.some(env => env.releaseUnknown) &&
      !b.match &&
      !isMirror(b) &&
      b.weight > 0 &&
      deployed.length > 0 &&
      deployed.every(env =>
        servedBackends(env).every(
          s =>
            s.name !== b.name ||
            (s.weight === 0 && !s.match && !(s.mirror && s.mirror.percent > 0)),
        ),
      ),
  );

  const handleRemoved = (message: string, backendName: string) => {
    setSaved(message);
    onChanged({ kind: 'remove', backendName });
    void refetch();
  };

  const atMax = backends.length >= MAX_ENDPOINT_BACKENDS;
  let addTooltip = blockedReason;
  if (!addTooltip && atMax) {
    addTooltip = `An Endpoint takes at most ${MAX_ENDPOINT_BACKENDS} backends.`;
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="subtitle2" style={{ flex: 1 }}>
          Backends ({backends.length})
        </Typography>
        <Tooltip title={addTooltip}>
          <span>
            <Button
              size="small"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => navigate('add-backend')}
              disabled={!canChange || atMax}
            >
              Add backend
            </Button>
          </span>
        </Tooltip>
      </Box>

      {saved && (
        <Box mb={1}>
          <Alert severity="success" onClose={() => setSaved(null)}>
            {saved}
          </Alert>
        </Box>
      )}

      {retired && (
        <Box mb={1}>
          <Alert
            severity="info"
            action={
              <Tooltip title={removeProblem(backends, retired.name)}>
                <span>
                  <Button
                    color="primary"
                    size="small"
                    onClick={() => setRemoving(retired)}
                    disabled={
                      !canChange ||
                      Boolean(removeProblem(backends, retired.name))
                    }
                  >
                    Remove
                  </Button>
                </span>
              </Tooltip>
            }
          >
            Backend {backendLabel(retired)} gets no traffic in any environment.
            {removeProblem(backends, retired.name) &&
              ` ${removeProblem(backends, retired.name)}`}
          </Alert>
        </Box>
      )}

      {trafficError && !trafficLoading && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Couldn’t read the backends: {trafficError.message}
        </Alert>
      )}
      {backends.length === 0 && (info || trafficLoading) && (
        <Typography variant="body2" color="textSecondary">
          {info ? 'No backends configured.' : 'Loading backends…'}
        </Typography>
      )}
      {backends.map(b => {
        const share = b.mirror ? b.mirror.percent : shares[b.name] ?? 0;
        let note = '';
        if (b.match) note = `+ if ${describeMatch(b.match)}`;
        if (b.mirror) note = 'Copies only; answers dropped';
        return (
          <Box key={b.name} className={classes.backend}>
            <Box className={classes.backendHeader}>
              <Box minWidth={0}>
                <Typography
                  variant="body2"
                  component="div"
                  className={classes.name}
                >
                  <span
                    className={classes.dot}
                    style={{ backgroundColor: colors.get(b.name) }}
                  />
                  <EntityRefLink
                    entityRef={{
                      kind: 'component',
                      namespace,
                      name: b.componentName,
                    }}
                  />
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    component="span"
                  >
                    {b.releaseLine ? ` @ ${b.releaseLine}` : ''} / {b.endpoint}
                  </Typography>
                </Typography>
                {note && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    component="div"
                  >
                    {note}
                  </Typography>
                )}
              </Box>
              <Box className={classes.backendActions}>
                <Tooltip
                  title={
                    blockedReason ||
                    (b.mirror ? 'Edit the copy' : 'Edit the shares')
                  }
                >
                  <span>
                    <Button
                      size="small"
                      className={classes.share}
                      aria-label={`Edit the share of ${b.name}`}
                      disabled={!canChange}
                      onClick={() =>
                        navigate(
                          `backend/${encodeURIComponent(b.name)}${
                            b.mirror ? '' : '?focus=share'
                          }`,
                        )
                      }
                    >
                      {b.mirror ? `copy ${share}%` : `${share}%`}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={blockedReason || 'Change how it gets traffic'}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`Edit ${b.name}`}
                      disabled={!canChange}
                      onClick={() =>
                        navigate(`backend/${encodeURIComponent(b.name)}`)
                      }
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    blockedReason ||
                    removeProblem(backends, b.name) ||
                    'Remove backend'
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`Remove ${b.name}`}
                      onClick={() => setRemoving(b)}
                      disabled={
                        !canChange || Boolean(removeProblem(backends, b.name))
                      }
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={share}
              className={classes.bar}
              style={{ '--backend-color': colors.get(b.name) } as CSSProperties}
              classes={{
                bar: b.mirror
                  ? `${classes.fill} ${classes.copyFill}`
                  : classes.fill,
              }}
              aria-label={
                b.mirror ? `${b.name} copy share` : `${b.name} traffic share`
              }
            />
          </Box>
        );
      })}

      <RemoveBackendDialog
        backend={removing}
        info={info}
        entity={entity}
        onClose={() => setRemoving(null)}
        onRemoved={message => removing && handleRemoved(message, removing.name)}
      />
    </Box>
  );
};
