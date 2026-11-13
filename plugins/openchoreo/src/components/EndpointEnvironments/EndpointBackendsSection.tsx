import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import { useEntity } from '@backstage/plugin-catalog-react';
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
import type { EndpointBackendChange } from './useAwaitEndpointRelease';

const IN_PROGRESS = 'Wait for the new release from the last change.';

/**
 * The Endpoint's backends on the Set up pane, where they're changed: added,
 * reweighted and removed. Each change cuts a new release; `onChanged` hands
 * the change to the pane, which shows it in progress until the release is
 * cut. Changes are disabled meanwhile (`awaiting`).
 */
export const EndpointBackendsSection = ({
  awaiting,
  onChanged,
}: {
  awaiting: boolean;
  onChanged: (change: EndpointBackendChange) => void;
}) => {
  const { entity } = useEntity();
  const { canUpdate, loading, updateDeniedTooltip } =
    useResourceDefinitionPermission();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EndpointBackend | null>(null);
  const [removing, setRemoving] = useState<EndpointBackend | null>(null);

  const backends =
    (entity.spec as { backends?: EndpointBackend[] } | undefined)?.backends ??
    [];
  const namespace = entity.metadata.namespace ?? 'default';
  const permitted = canUpdate && !loading;
  const canChange = permitted && !awaiting;
  const atMax = backends.length >= MAX_ENDPOINT_BACKENDS;

  // Why a control is disabled, before any reason of its own.
  let blockedReason = '';
  if (!permitted) blockedReason = updateDeniedTooltip;
  else if (awaiting) blockedReason = IN_PROGRESS;

  let addTooltip = blockedReason;
  if (!addTooltip && atMax) {
    addTooltip = `An Endpoint takes at most ${MAX_ENDPOINT_BACKENDS} backends.`;
  }

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
              aria-label="Add backend"
              onClick={() => setAddOpen(true)}
              disabled={!canChange || atMax}
            >
              Add
            </Button>
          </span>
        </Tooltip>
      </Box>

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
                title={blockedReason || `Weight ${backend.weight ?? 1}. Edit`}
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
                  blockedReason ||
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
        onAdded={onChanged}
        entity={entity}
        backends={backends}
      />
      <EditBackendWeightDialog
        backend={editing}
        backends={backends}
        entity={entity}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
      <RemoveBackendDialog
        backend={removing}
        backends={backends}
        entity={entity}
        onClose={() => setRemoving(null)}
        onSaved={onChanged}
      />
    </Box>
  );
};
