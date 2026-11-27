import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import {
  describeMatch,
  isMirror,
  splitOf,
  type EndpointTrafficBackend,
  type EndpointTrafficInfo,
  backendLabel,
  labelOf,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { getErrorMessage } from '../../../utils/errorUtils';
import { servedBackends } from './useEndpointTraffic';

/** Why a backend can't be removed, or ''. */
export function removeProblem(
  backends: EndpointTrafficBackend[],
  name: string,
): string {
  if (backends.length <= 1) return 'An Endpoint needs at least one backend.';
  const shared = backends.filter(b => b.name !== name && !isMirror(b));
  if (shared.length === 0 || shared.every(b => b.weight === 0)) {
    return `Removing ${labelOf(
      backends,
      name,
    )} leaves no backend with a share. Give another backend a share first, with ✎.`;
  }
  return '';
}

/** What each environment that sends a backend traffic does once it gets the release without it. */
export function removeImpact(
  info: EndpointTrafficInfo,
  name: string,
): string[] {
  return info.environments.flatMap(env => {
    if (!env.endpointRelease) return [];
    const served = servedBackends(env).find(b => b.name === name);
    if (!served) return [];
    if (served.mirror) {
      return served.mirror.percent > 0
        ? [
            `${env.environment}: copies ${served.mirror.percent}% of requests to it.`,
          ]
        : [];
    }
    const share = splitOf(servedBackends(env))[name] ?? 0;
    const own = env.overrides.some(o => o.name === name && (o.weight ?? 0) > 0);
    const parts: string[] = [];
    if (served.match) {
      parts.push(`gets requests with ${describeMatch(served.match)}`);
    }
    if (share > 0) parts.push(`gets ${share}% of the rest`);
    if (parts.length === 0) return [];
    const then = own
      ? `its own split gives ${name} a share, so it goes back to the default split.`
      : 'the other backends take it over.';
    return [
      `${env.environment}: ${parts.join(
        ' and ',
      )} now; once it gets the release, ${then}`,
    ];
  });
}

/**
 * Confirms removing a backend, saying where it still gets traffic and what
 * each of those environments does once it gets the release without it.
 * Refuses a removal that would leave no backend with a share.
 */
export const RemoveBackendDialog = ({
  backend,
  info,
  entity,
  onClose,
  onRemoved,
}: {
  backend: EndpointTrafficBackend | null;
  info: EndpointTrafficInfo | null;
  entity: Entity;
  onClose: () => void;
  onRemoved: (message: string) => void;
}) => {
  const client = useApi(openChoreoClientApiRef);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (backend) setError(null);
  }, [backend]);

  const problem =
    backend && info ? removeProblem(info.backends, backend.name) : '';
  const impact = backend && info ? removeImpact(info, backend.name) : [];
  const endpointName = entity.metadata.title ?? entity.metadata.name;

  const remove = async () => {
    if (!backend) return;
    setSaving(true);
    setError(null);
    try {
      await client.removeTrafficBackend(entity, backend.name);
      onRemoved(`Backend ${backendLabel(backend)} removed.`);
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!backend}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="remove-traffic-backend-title"
    >
      <DialogTitle id="remove-traffic-backend-title">
        Remove backend {backend && backendLabel(backend)}?
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {endpointName} stops routing to {backend && backendLabel(backend)}.
          The {backend?.componentName} component isn’t changed. Saving cuts a
          release; each environment keeps the backend until it gets that
          release.
        </DialogContentText>
        {impact.length > 0 && (
          <Box mb={2}>
            <Typography variant="subtitle2" gutterBottom>
              Where it still gets traffic
            </Typography>
            {impact.map(line => (
              <Typography key={line} variant="body2" color="textSecondary">
                {line}
              </Typography>
            ))}
          </Box>
        )}
        {problem && <Alert severity="warning">{problem}</Alert>}
        {error && (
          <Box mt={1}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          color="secondary"
          variant="contained"
          disabled={saving || Boolean(problem)}
          onClick={() => void remove()}
        >
          {saving ? 'Removing...' : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
