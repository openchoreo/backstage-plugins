import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import {
  MAX_ENDPOINT_BACKEND_WEIGHT,
  endpointBackendsTakeTraffic,
  isEndpointBackendWeight,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { getErrorMessage } from '../../utils/errorUtils';
import type { EndpointBackend } from '../EndpointOverview/EndpointBackendList';
import type { EndpointBackendChange } from './useAwaitEndpointRelease';

export const backendLabel = (backend: EndpointBackend) =>
  backend.component
    ? `${backend.component}${backend.endpoint ? ` / ${backend.endpoint}` : ''}`
    : backend.name;

/** Runs a save, keeping the dialog open with the error when it fails. */
function useSave(onDone: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (save: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await save();
      onDone();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, setError, run };
}

interface BackendDialogProps {
  /** The backend acted on; the dialog is open while it is set. */
  backend: EndpointBackend | null;
  /** All of the Endpoint's backends, to check traffic still flows. */
  backends: EndpointBackend[];
  entity: Entity;
  onClose: () => void;
  /** Called once the change is saved, with the change made. */
  onSaved: (change: EndpointBackendChange) => void;
}

const NO_TRAFFIC =
  'At least one backend needs a weight above 0, or the Endpoint sends no traffic.';

/** Sets the relative weight of one of an Endpoint's backends. */
export const EditBackendWeightDialog = ({
  backend,
  backends,
  entity,
  onClose,
  onSaved,
}: BackendDialogProps) => {
  const client = useApi(openChoreoClientApiRef);
  const [weight, setWeight] = useState('1');
  const { saving, error, setError, run } = useSave(onClose);

  useEffect(() => {
    if (backend) {
      setWeight(String(backend.weight ?? 1));
      setError(null);
    }
  }, [backend, setError]);

  const parsed = Number(weight);
  const valid = weight !== '' && isEndpointBackendWeight(parsed);
  const takesTraffic =
    !valid ||
    endpointBackendsTakeTraffic(
      backends.map(b =>
        b.name === backend?.name ? { ...b, weight: parsed } : b,
      ),
    );

  let helperText: string | undefined;
  if (!valid) {
    helperText = `A whole number from 0 to ${MAX_ENDPOINT_BACKEND_WEIGHT.toLocaleString(
      'en-US',
    )}`;
  } else if (!takesTraffic) {
    helperText = NO_TRAFFIC;
  }

  return (
    <Dialog
      open={!!backend}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="edit-backend-weight-dialog-title"
    >
      <DialogTitle id="edit-backend-weight-dialog-title">
        Edit weight
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Traffic share of {backend && backendLabel(backend)}, relative to the
          other backends. 0 sends it no traffic.
        </DialogContentText>
        <TextField
          id="endpoint-backend-weight"
          type="number"
          variant="outlined"
          size="small"
          label="Weight"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          inputProps={{ min: 0, max: MAX_ENDPOINT_BACKEND_WEIGHT, step: 1 }}
          error={!valid || !takesTraffic}
          helperText={helperText}
          disabled={saving}
        />
        {error && (
          <Box mt={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          color="primary"
          variant="contained"
          disabled={
            saving ||
            !valid ||
            !takesTraffic ||
            parsed === (backend?.weight ?? 1)
          }
          onClick={() =>
            backend &&
            run(async () => {
              await client.updateEndpointBackendWeight(
                entity,
                backend.name,
                parsed,
              );
              onSaved({
                kind: 'weight',
                backendName: backend.name,
                weight: parsed,
              });
            })
          }
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Removes one of an Endpoint's backends, after confirming. */
export const RemoveBackendDialog = ({
  backend,
  backends,
  entity,
  onClose,
  onSaved,
}: BackendDialogProps) => {
  const client = useApi(openChoreoClientApiRef);
  const { saving, error, setError, run } = useSave(onClose);

  useEffect(() => {
    if (backend) setError(null);
  }, [backend, setError]);

  const takesTraffic = endpointBackendsTakeTraffic(
    backends.filter(b => b.name !== backend?.name),
  );

  return (
    <Dialog
      open={!!backend}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="remove-backend-dialog-title"
    >
      <DialogTitle id="remove-backend-dialog-title">
        Remove backend?
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {entity.metadata.title ?? entity.metadata.name} stops routing traffic
          to {backend && backendLabel(backend)}. The other backends share it.
        </DialogContentText>
        {!takesTraffic && <Alert severity="warning">{NO_TRAFFIC}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          color="secondary"
          variant="contained"
          disabled={saving || !takesTraffic}
          onClick={() =>
            backend &&
            run(async () => {
              await client.removeEndpointBackend(entity, backend.name);
              onSaved({ kind: 'remove', backendName: backend.name });
            })
          }
        >
          {saving ? 'Removing...' : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
