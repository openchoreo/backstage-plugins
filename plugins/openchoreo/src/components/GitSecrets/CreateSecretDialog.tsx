import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  Typography,
} from '@material-ui/core';

interface CreateSecretDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (secretName: string, token: string) => Promise<void>;
  namespaceName: string;
}

/**
 * Dialog for creating a new git secret.
 */
export const CreateSecretDialog: React.FC<CreateSecretDialogProps> = ({
  open,
  onClose,
  onSubmit,
  namespaceName,
}) => {
  const [secretName, setSecretName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!secretName.trim() || !token.trim()) {
      setError('Both secret name and token are required');
      return;
    }

    // Validate secret name format (Kubernetes naming convention)
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!nameRegex.test(secretName)) {
      setError(
        'Secret name must consist of lowercase alphanumeric characters or dashes, ' +
          'start with an alphanumeric character, and be at most 253 characters long',
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(secretName.trim(), token.trim());
      // Reset form on success
      setSecretName('');
      setToken('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create git secret',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSecretName('');
      setToken('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Git Secret</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Create a new git secret in namespace <strong>{namespaceName}</strong>{' '}
          for accessing private repositories.
        </Typography>

        <TextField
          autoFocus
          margin="dense"
          label="Secret Name"
          fullWidth
          variant="outlined"
          value={secretName}
          onChange={e => setSecretName(e.target.value.toLowerCase())}
          disabled={loading}
          helperText="A unique name for this secret (lowercase, alphanumeric, dashes allowed)"
          style={{ marginTop: 16 }}
        />

        <TextField
          margin="dense"
          label="Personal Access Token"
          fullWidth
          variant="outlined"
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          disabled={loading}
          helperText="Your git provider personal access token with repository read permissions"
          style={{ marginTop: 16 }}
        />

        {error && (
          <Typography
            variant="body2"
            color="error"
            style={{ marginTop: 16 }}
          >
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={loading || !secretName.trim() || !token.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Creating...' : 'Create Secret'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
