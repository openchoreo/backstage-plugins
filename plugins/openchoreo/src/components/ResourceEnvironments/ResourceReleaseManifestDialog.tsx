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
import type { Entity } from '@backstage/catalog-model';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import YAML from 'yaml';
import {
  openChoreoClientApiRef,
  type OpenChoreoClientApi,
} from '../../api/OpenChoreoClientApi';
import { useNotification } from '../../hooks';

/**
 * Fetches a release CR by name. Pass a stable function (a module-level
 * constant), since the dialog refetches when it changes.
 */
export type LoadRelease = (
  client: OpenChoreoClientApi,
  entity: Entity,
  releaseName: string,
) => Promise<{ success: boolean; data?: Record<string, unknown> }>;

export interface ReleaseManifestDialogProps {
  open: boolean;
  onClose: () => void;
  releaseName?: string;
  environmentName: string;
  loadRelease: LoadRelease;
}

/**
 * Modal dialog that fetches the release CR for the given `releaseName` and
 * renders it as YAML. Mirrors the Component-side ReleaseManifestDialog so
 * users can inspect the frozen snapshot pinned to an env without dropping to
 * kubectl. Resource and Endpoint deploy tabs supply their own loader.
 *
 * Refetches every time the dialog opens — manifests are small enough
 * that staleness is more annoying than re-fetching.
 */
export const ReleaseManifestDialog = ({
  open,
  onClose,
  releaseName,
  environmentName,
  loadRelease,
}: ReleaseManifestDialogProps) => {
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
    loadRelease(api, entity, releaseName)
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
  }, [api, entity, open, releaseName, loadRelease]);

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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="release-manifest-dialog-title"
    >
      <DialogTitle id="release-manifest-dialog-title">
        Release manifest — {environmentName}
      </DialogTitle>
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

const loadResourceRelease: LoadRelease = (client, entity, releaseName) =>
  client.fetchResourceRelease(entity, releaseName);

export type ResourceReleaseManifestDialogProps = Omit<
  ReleaseManifestDialogProps,
  'loadRelease'
>;

/** Release manifest dialog for a Resource's ResourceReleases. */
export const ResourceReleaseManifestDialog = (
  props: ResourceReleaseManifestDialogProps,
) => <ReleaseManifestDialog {...props} loadRelease={loadResourceRelease} />;
