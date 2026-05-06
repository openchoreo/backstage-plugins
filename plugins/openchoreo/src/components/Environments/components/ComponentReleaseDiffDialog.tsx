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

/**
 * Modal that fetches both `ComponentRelease` manifests in parallel and
 * renders them in a side-by-side YAML diff. Used to surface what
 * actually differs between an env and its upstream when drift is
 * flagged.
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

  useEffect(() => {
    if (!open || !releaseName || !upstreamReleaseName) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOriginal(null);
    setModified(null);
    Promise.all([
      api.fetchComponentRelease(entity, upstreamReleaseName),
      api.fetchComponentRelease(entity, releaseName),
    ])
      .then(([upRes, dnRes]) => {
        if (cancelled) return;
        if (!upRes?.success || !upRes.data) {
          setError(`Couldn't fetch ${upstreamEnvName}'s release manifest.`);
          return;
        }
        if (!dnRes?.success || !dnRes.data) {
          setError(`Couldn't fetch ${environmentName}'s release manifest.`);
          return;
        }
        setOriginal(YAML.stringify(upRes.data));
        setModified(YAML.stringify(dnRes.data));
      })
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
        {(!releaseName || !upstreamReleaseName) && (
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
        {original && modified && (
          <YamlDiffViewer
            original={original}
            modified={modified}
            originalLabel={`${upstreamEnvName} (${upstreamReleaseName})`}
            modifiedLabel={`${environmentName} (${releaseName})`}
            height="60vh"
          />
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
