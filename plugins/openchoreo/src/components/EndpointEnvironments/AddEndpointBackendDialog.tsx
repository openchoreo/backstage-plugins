import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  MAX_ENDPOINT_BACKEND_WEIGHT,
  isEndpointBackendWeight,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { useProjectWorkloadEndpoints } from '../../scaffolder/EndpointBackendsField/useProjectWorkloadEndpoints';
import { getErrorMessage } from '../../utils/errorUtils';
import type { EndpointBackend } from '../EndpointOverview/EndpointBackendList';
import type { EndpointBackendChange } from './useAwaitEndpointRelease';

const optionKey = (component: string, endpoint: string) =>
  `${component}/${endpoint}`;

interface AddEndpointBackendDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called once the backend is saved, with the change made. */
  onAdded: (change: EndpointBackendChange) => void;
  entity: Entity;
  backends: EndpointBackend[];
}

/**
 * Adds a backend to an Endpoint: any workload endpoint in its project, since
 * the Endpoint carries the visibility. When a component owns the Endpoint,
 * the dialog warns up front that a backend on another component moves the
 * Endpoint to its project, which the API does on save.
 */
export const AddEndpointBackendDialog = ({
  open,
  onClose,
  onAdded,
  entity,
  backends,
}: AddEndpointBackendDialogProps) => {
  const client = useApi(openChoreoClientApiRef);
  const annotations = entity.metadata.annotations ?? {};
  const project = annotations[CHOREO_ANNOTATIONS.PROJECT];
  const ownerComponent =
    annotations[CHOREO_ANNOTATIONS.ENDPOINT_OWNER_COMPONENT];
  const endpointName = entity.metadata.title ?? entity.metadata.name;
  const [selected, setSelected] = useState('');
  const [weight, setWeight] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected('');
      setWeight('1');
      setError(null);
    }
  }, [open]);

  const {
    options,
    loading,
    error: loadError,
  } = useProjectWorkloadEndpoints(
    open ? entity.metadata.namespace : undefined,
    project,
  );
  const available = useMemo(() => {
    const taken = new Set(
      backends.map(b => optionKey(b.component ?? '', b.endpoint ?? '')),
    );
    return options.filter(o => !taken.has(optionKey(o.component, o.endpoint)));
  }, [options, backends]);

  const option = available.find(
    o => optionKey(o.component, o.endpoint) === selected,
  );
  const parsedWeight = Number(weight);
  const weightValid = weight !== '' && isEndpointBackendWeight(parsedWeight);

  const handleAdd = async () => {
    if (!option || !weightValid) return;
    setSaving(true);
    setError(null);
    try {
      const { backendName } = await client.addEndpointBackend(entity, {
        component: option.component,
        workloadEndpoint: option.endpoint,
        weight: parsedWeight,
      });
      onAdded({ kind: 'add', backendName });
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  let picker = (
    <TextField
      id="endpoint-backend-workload-endpoint"
      select
      fullWidth
      variant="outlined"
      size="small"
      label="Workload endpoint"
      value={selected}
      onChange={e => setSelected(e.target.value as string)}
      disabled={saving}
      helperText={
        available.length === 0
          ? `No other workload endpoint in project ${project} to route to.`
          : undefined
      }
    >
      {available.map(o => (
        <MenuItem
          key={optionKey(o.component, o.endpoint)}
          value={optionKey(o.component, o.endpoint)}
        >
          {`${o.component} / ${o.endpoint}`}
        </MenuItem>
      ))}
    </TextField>
  );
  if (loading) {
    picker = <CircularProgress size={24} />;
  } else if (loadError) {
    picker = (
      <Alert severity="error">
        Could not load the project's workload endpoints:{' '}
        {getErrorMessage(loadError)}
      </Alert>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="add-endpoint-backend-dialog-title"
    >
      <DialogTitle id="add-endpoint-backend-dialog-title">
        Add backend
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Route part of {endpointName}'s traffic to another workload endpoint in
          project {project}.
        </DialogContentText>
        {ownerComponent && (
          <Box mb={2}>
            <Alert severity="warning">
              Component {ownerComponent} owns {endpointName} endpoint. Adding a
              backend on another component moves it to project {project}, so
              deleting {ownerComponent} no longer deletes it.
            </Alert>
          </Box>
        )}
        <Box mb={2}>{picker}</Box>
        <TextField
          id="endpoint-backend-weight"
          type="number"
          variant="outlined"
          size="small"
          label="Weight"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          inputProps={{ min: 0, max: MAX_ENDPOINT_BACKEND_WEIGHT, step: 1 }}
          error={!weightValid}
          helperText={
            weightValid
              ? 'Relative to the other backends. 0 sends it no traffic.'
              : `A whole number from 0 to ${MAX_ENDPOINT_BACKEND_WEIGHT.toLocaleString(
                  'en-US',
                )}`
          }
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
          onClick={handleAdd}
          disabled={saving || !option || !weightValid}
        >
          {saving ? 'Adding...' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
