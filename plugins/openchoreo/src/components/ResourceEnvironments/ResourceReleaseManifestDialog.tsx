import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import YAML from 'yaml';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { useNotification } from '../../hooks';

export interface ResourceReleaseManifestDialogProps {
  open: boolean;
  onClose: () => void;
  releaseName?: string;
  environmentName: string;
}

/**
 * Modal dialog that fetches the ResourceRelease CR for the given
 * `releaseName` and renders it as YAML. Mirrors the Component-side
 * ReleaseManifestDialog so users can inspect the frozen snapshot
 * pinned to an env without dropping to kubectl.
 *
 * Refetches every time the dialog opens — manifests are small enough
 * that staleness is more annoying than re-fetching.
 */
export const ResourceReleaseManifestDialog = ({
  open,
  onClose,
  releaseName,
  environmentName,
}: ResourceReleaseManifestDialogProps) => {
  const api = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();
  const notification = useNotification();
  const [yamlText, setYamlText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !releaseName) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setYamlText(null);
    api
      .fetchResourceRelease(entity, releaseName)
      .then(response => {
        if (cancelled) return;
        if (!response?.success || !response.data) {
          setError('Release manifest is not available.');
          return;
        }
        setYamlText(YAML.stringify(response.data));
      })
      .catch(e => {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to fetch release manifest');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, entity, open, releaseName]);

  const handleCopy = async () => {
    if (!yamlText) return;
    try {
      await navigator.clipboard.writeText(yamlText);
      notification.showSuccess('Copied release manifest');
    } catch {
      notification.showError('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Release manifest — {environmentName}</DialogTitle>
      <DialogContent dividers>
        {!releaseName && (
          <Typography variant="body2" color="textSecondary">
            No release on this environment yet.
          </Typography>
        )}
        {loading && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={24} />
          </Box>
        )}
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
        {yamlText && (
          <YamlViewer value={yamlText} maxHeight="60vh" showLineNumbers />
        )}
      </DialogContent>
      <DialogActions>
        <Button
          startIcon={<FileCopyOutlinedIcon />}
          onClick={handleCopy}
          disabled={!yamlText}
        >
          Copy
        </Button>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
