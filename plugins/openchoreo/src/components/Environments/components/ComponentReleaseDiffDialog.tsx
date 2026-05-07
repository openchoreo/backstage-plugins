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
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import { YamlDiffViewer } from '@openchoreo/backstage-plugin-react';
import YAML from 'yaml';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

export interface ComponentReleaseDiffDialogProps {
  open: boolean;
  onClose: () => void;
  /** The downstream env (the one that's behind). */
  environmentName: string;
  releaseName?: string;
  /** The upstream env that's ahead. */
  upstreamEnvName: string;
  upstreamReleaseName?: string;
}

type PreviewMode = 'diff' | 'source-only' | 'target-only' | 'empty';

/**
 * Modal that fetches both `ComponentRelease` manifests and renders a
 * side-by-side YAML diff. When only one side has a release (e.g. a
 * first-time promotion to a brand-new env), gracefully degrades to a
 * single-manifest preview with explanatory copy.
 */
export const ComponentReleaseDiffDialog = ({
  open,
  onClose,
  environmentName,
  releaseName,
  upstreamEnvName,
  upstreamReleaseName,
}: ComponentReleaseDiffDialogProps) => {
  const api = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();
  const [original, setOriginal] = useState<string | null>(null);
  const [modified, setModified] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resolvePreviewMode = (): PreviewMode => {
    if (releaseName && upstreamReleaseName) return 'diff';
    if (upstreamReleaseName) return 'source-only';
    if (releaseName) return 'target-only';
    return 'empty';
  };
  const previewMode = resolvePreviewMode();

  useEffect(() => {
    if (!open || previewMode === 'empty') {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOriginal(null);
    setModified(null);

    const fetches: Array<Promise<unknown>> = [];
    if (upstreamReleaseName) {
      fetches.push(
        api.fetchComponentRelease(entity, upstreamReleaseName).then(res => {
          if (cancelled) return;
          if (!res?.success || !res.data) {
            setError(`Couldn't fetch ${upstreamEnvName}'s release manifest.`);
            return;
          }
          setOriginal(YAML.stringify(res.data));
        }),
      );
    }
    if (releaseName) {
      fetches.push(
        api.fetchComponentRelease(entity, releaseName).then(res => {
          if (cancelled) return;
          if (!res?.success || !res.data) {
            setError(`Couldn't fetch ${environmentName}'s release manifest.`);
            return;
          }
          setModified(YAML.stringify(res.data));
        }),
      );
    }
    Promise.all(fetches)
      .catch(e => {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to fetch release manifests');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    api,
    entity,
    open,
    previewMode,
    releaseName,
    upstreamReleaseName,
    environmentName,
    upstreamEnvName,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Release diff — {upstreamEnvName} → {environmentName}
      </DialogTitle>
      <DialogContent dividers>
        {previewMode === 'empty' && (
          <Typography variant="body2" color="textSecondary">
            Both environments need a release on them to compare.
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
        {previewMode === 'diff' && original && modified && (
          <YamlDiffViewer
            original={original}
            modified={modified}
            originalLabel={`${upstreamEnvName} (${upstreamReleaseName})`}
            modifiedLabel={`${environmentName} (${releaseName})`}
            height="60vh"
          />
        )}
        {previewMode === 'source-only' && original && (
          <>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              <strong>{environmentName}</strong> has no release yet — this is
              the manifest that will be created from{' '}
              <strong>{upstreamEnvName}</strong>.
            </Typography>
            <YamlViewer value={original} maxHeight="60vh" showLineNumbers />
          </>
        )}
        {previewMode === 'target-only' && modified && (
          <>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              <strong>{upstreamEnvName}</strong> has no release to compare;
              showing <strong>{environmentName}</strong>'s current manifest.
            </Typography>
            <YamlViewer value={modified} maxHeight="60vh" showLineNumbers />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
