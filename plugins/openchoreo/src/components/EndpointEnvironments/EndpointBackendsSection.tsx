import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import AddIcon from '@material-ui/icons/Add';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import { useAsyncEntity, useEntity } from '@backstage/plugin-catalog-react';
import { MAX_ENDPOINT_BACKENDS } from '@openchoreo/backstage-plugin-common';
import { useResourceDefinitionPermission } from '@openchoreo/backstage-plugin-react';
import {
  EndpointBackendList,
  type EndpointBackend,
} from '../EndpointOverview/EndpointBackendList';
import { AddEndpointBackendDialog } from './AddEndpointBackendDialog';
import {
  EditBackendWeightDialog,
  RemoveBackendDialog,
  backendLabel,
} from './EndpointBackendDialogs';

/**
 * How long after a change to look for the release it cuts: the controller
 * cuts it within seconds, and the catalog entity follows by event.
 */
const RELEASE_RECHECK_MS = [3000, 8000];

/**
 * The Endpoint's backends on the Set up pane, where they're changed: added,
 * reweighted and removed. Each change cuts a new release, which the pane
 * then offers to deploy; `onChanged` is called to look for it.
 */
export const EndpointBackendsSection = ({
  onChanged,
}: {
  onChanged: () => void;
}) => {
  const { entity } = useEntity();
  const { refresh } = useAsyncEntity();
  const { canUpdate, loading, updateDeniedTooltip } =
    useResourceDefinitionPermission();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EndpointBackend | null>(null);
  const [removing, setRemoving] = useState<EndpointBackend | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const backends =
    (entity.spec as { backends?: EndpointBackend[] } | undefined)?.backends ??
    [];
  const namespace = entity.metadata.namespace ?? 'default';
  const canChange = canUpdate && !loading;
  const atMax = backends.length >= MAX_ENDPOINT_BACKENDS;

  const handleSaved = (message: string) => {
    setSaved(`${message} A new release is cut in a few seconds.`);
    onChanged();
    timers.current.forEach(clearTimeout);
    timers.current = RELEASE_RECHECK_MS.map(ms =>
      setTimeout(() => {
        refresh?.();
        onChanged();
      }, ms),
    );
  };

  let addTooltip = '';
  if (!canChange) addTooltip = updateDeniedTooltip;
  else if (atMax)
    addTooltip = `An Endpoint takes at most ${MAX_ENDPOINT_BACKENDS} backends.`;

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1}
      >
        <Typography variant="subtitle2">
          Backends ({backends.length})
        </Typography>
        <Tooltip title={addTooltip}>
          <span>
            <Button
              size="small"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
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

      {backends.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          No backends configured.
        </Typography>
      ) : (
        <EndpointBackendList
          backends={backends}
          namespace={namespace}
          renderActions={backend => (
            <>
              <Tooltip
                title={
                  canChange
                    ? `Weight ${backend.weight ?? 1}. Edit`
                    : updateDeniedTooltip
                }
              >
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Edit weight of ${backendLabel(backend)}`}
                    onClick={() => setEditing(backend)}
                    disabled={!canChange}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip
                title={
                  (!canChange && updateDeniedTooltip) ||
                  (backends.length === 1
                    ? 'An Endpoint needs at least one backend.'
                    : 'Remove backend')
                }
              >
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Remove ${backendLabel(backend)}`}
                    onClick={() => setRemoving(backend)}
                    disabled={!canChange || backends.length === 1}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        />
      )}

      <AddEndpointBackendDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleSaved}
        entity={entity}
        backends={backends}
      />
      <EditBackendWeightDialog
        backend={editing}
        backends={backends}
        entity={entity}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
      <RemoveBackendDialog
        backend={removing}
        backends={backends}
        entity={entity}
        onClose={() => setRemoving(null)}
        onSaved={handleSaved}
      />
    </Box>
  );
};
