import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { getErrorMessage } from '../../../utils/errorUtils';

/**
 * DNS-1123 subdomain: lowercase alphanumeric, '-', '.', max 253 chars,
 * must start and end with alphanumeric. We use the stricter "label"
 * shape (no dots) because ComponentRelease names are k8s object names.
 */
const DNS_1123_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const MAX_NAME_LENGTH = 253;

const validateReleaseName = (
  name: string,
  existingNames: Set<string>,
): string | null => {
  if (!name) return null; // empty is fine — backend auto-generates
  if (name.length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  if (!DNS_1123_LABEL.test(name)) {
    return 'Use lowercase letters, digits, and hyphens. Must start and end with a letter or digit.';
  }
  if (existingNames.has(name)) {
    return 'A release with this name already exists.';
  }
  return null;
};

export interface CreateReleaseDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created release's name once the API call succeeds. */
  onCreated: (releaseName: string) => void;
  /** Existing releases used for client-side uniqueness validation. */
  existingReleases: ComponentRelease[];
  /**
   * When true, surface a notice that the controller will auto-deploy the
   * new release to the first environment.
   */
  autoDeployEnabled?: boolean;
  /** Display name of the first environment (used in the auto-deploy notice). */
  firstEnvironmentName?: string;
}

export const CreateReleaseDialog = ({
  open,
  onClose,
  onCreated,
  existingReleases,
  autoDeployEnabled,
  firstEnvironmentName,
}: CreateReleaseDialogProps) => {
  const client = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setSubmitError(null);
      setSubmitting(false);
    }
  }, [open]);

  const existingNames = useMemo(
    () =>
      new Set(
        existingReleases
          .map(r => r.metadata?.name)
          .filter((n): n is string => !!n),
      ),
    [existingReleases],
  );

  const validationError = validateReleaseName(name.trim(), existingNames);

  const handleSubmit = async () => {
    if (validationError) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const trimmed = name.trim();
      const response = await client.createComponentRelease(
        entity,
        trimmed || undefined,
      );
      const created = response.data?.name;
      if (!created) {
        throw new Error('Release was created but no name was returned.');
      }
      onCreated(created);
    } catch (e: unknown) {
      setSubmitError(getErrorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Create release</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          A release captures an immutable snapshot of the current workload,
          traits, and parameters. You can deploy it now or later.
        </Typography>

        <Box mt={2}>
          <TextField
            label="Release name (optional)"
            placeholder="auto-generated if blank"
            value={name}
            onChange={e => setName(e.target.value)}
            error={!!validationError}
            helperText={
              validationError ||
              'Leave blank to let OpenChoreo generate a name. Lowercase letters, digits, and hyphens only.'
            }
            fullWidth
            disabled={submitting}
            inputProps={{ maxLength: MAX_NAME_LENGTH }}
          />
        </Box>

        {autoDeployEnabled && (
          <Box mt={2}>
            <Alert severity="info">
              Auto Deploy is on, so this release will also deploy to{' '}
              <strong>{firstEnvironmentName || 'the first environment'}</strong>{' '}
              automatically.
            </Alert>
          </Box>
        )}

        {submitError && (
          <Box mt={2}>
            <Alert severity="error" onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={submitting || !!validationError}
          startIcon={
            submitting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {submitting ? 'Creating...' : 'Create release'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
