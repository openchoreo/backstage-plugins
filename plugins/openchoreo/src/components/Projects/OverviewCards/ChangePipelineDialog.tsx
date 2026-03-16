import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
} from '@material-ui/core';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

interface ChangePipelineDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  namespaceName: string;
  projectName: string;
  currentPipelineName?: string;
}

export const ChangePipelineDialog = ({
  open,
  onClose,
  onSaved,
  namespaceName,
  projectName,
  currentPipelineName,
}: ChangePipelineDialogProps) => {
  const catalogApi = useApi(catalogApiRef);
  const client = useApi(openChoreoClientApiRef);
  const alertApi = useApi(alertApiRef);

  const [pipelines, setPipelines] = useState<
    Array<{ name: string; displayName: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(currentPipelineName ?? '');

  useEffect(() => {
    if (!open) return undefined;

    let ignore = false;
    setLoading(true);
    setSelected(currentPipelineName ?? '');

    const fetchPipelines = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'DeploymentPipeline' },
        });
        const filtered = items.filter(
          e =>
            e.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
              namespaceName &&
            !e.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP],
        );
        if (!ignore) {
          setPipelines(
            filtered.map(e => ({
              name: e.metadata.name,
              displayName: (e.metadata.title || e.metadata.name) as string,
            })),
          );
        }
      } catch (err) {
        if (!ignore) {
          alertApi.post({
            message: `Failed to load pipelines: ${
              err instanceof Error ? err.message : String(err)
            }`,
            severity: 'error',
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchPipelines();
    return () => {
      ignore = true;
    };
  }, [open, namespaceName, catalogApi, alertApi, currentPipelineName]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.updateProjectPipeline(namespaceName, projectName, selected);
      alertApi.post({
        message: `Deployment pipeline changed to "${selected}"`,
        severity: 'success',
      });
      onSaved();
      onClose();
    } catch (err) {
      alertApi.post({
        message: `Failed to update pipeline: ${
          err instanceof Error ? err.message : String(err)
        }`,
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanged = selected !== (currentPipelineName ?? '');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Change Deployment Pipeline</DialogTitle>
      <DialogContent>
        <TextField
          select
          label="Deployment Pipeline"
          value={selected}
          onChange={e => setSelected(e.target.value)}
          disabled={loading}
          fullWidth
          variant="outlined"
          margin="normal"
          helperText="Select a deployment pipeline"
          InputProps={{
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            ) : undefined,
          }}
        >
          {pipelines.map(p => (
            <MenuItem key={p.name} value={p.name}>
              {p.displayName}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={saving || loading || !hasChanged || !selected}
        >
          {saving ? <CircularProgress size={20} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
