import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  FormHelperText,
  Box,
} from '@material-ui/core';

type SecretType = 'basic-auth' | 'ssh-auth';

interface CreateSecretDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (secretName: string, secretType: SecretType, tokenOrKey: string) => Promise<void>;
  namespaceName: string;
}

/**
 * Dialog for creating a new git secret.
 * Supports both Basic Authentication (token) and SSH Authentication (SSH key).
 */
export const CreateSecretDialog = ({
  open,
  onClose,
  onSubmit,
  namespaceName,
}) => {
  const [secretName, setSecretName] = useState('');
  const [secretType, setSecretType] = useState<SecretType>('basic-auth');
  const [token, setToken] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Validate required fields based on secret type
    if (!secretName.trim()) {
      setError('Secret name is required');
      return;
    }

    if (secretType === 'basic-auth' && !token.trim()) {
      setError('Token is required for Basic Authentication');
      return;
    }

    if (secretType === 'ssh-auth' && !sshKey.trim()) {
      setError('SSH key is required for SSH Authentication');
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

    // Validate SSH key format if SSH authentication is selected
    if (secretType === 'ssh-auth') {
      const trimmedKey = sshKey.trim();
      if (!trimmedKey.includes('BEGIN') || !trimmedKey.includes('PRIVATE KEY')) {
        setError('Invalid SSH key format. Please provide a valid private key.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Format SSH key: convert multiline to single line with \n
      const formattedValue = secretType === 'ssh-auth'
        ? sshKey.trim().replace(/\r\n/g, '\n') // Normalize line endings
        : token.trim();

      await onSubmit(secretName.trim(), secretType, formattedValue);

      // Reset form on success
      setSecretName('');
      setToken('');
      setSshKey('');
      setUploadedFileName('');
      setSecretType('basic-auth');
      setError(null);

      // Close the dialog
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
      setSshKey('');
      setUploadedFileName('');
      setSecretType('basic-auth');
      setError(null);
      onClose();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setSshKey(content);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setSshKey(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      PaperProps={{
        style: {
          borderRadius: 16,
          width: 600,
          position: 'fixed',
          top: '10%',
        },
      }}
    >
      <DialogTitle>
        <Typography variant="h4" component="div" style={{ fontWeight: 600 }}>
          Create Git Secret
        </Typography>
      </DialogTitle>
      <DialogContent style={{ minHeight: 300 }}>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Create a new git secret in namespace <strong>{namespaceName}</strong>{' '}
          for accessing private repositories.
        </Typography>

        <Box style={{ marginTop: 16 }}>
          <TextField
            margin="dense"
            label="Secret Name"
            fullWidth
            variant="outlined"
            value={secretName}
            onChange={e => setSecretName(e.target.value.toLowerCase())}
            disabled={loading}
          />
          <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
            Unique name of the secret.
          </FormHelperText>
        </Box>

        <FormControl component="fieldset" style={{ marginTop: 24 }}>
          <FormLabel component="legend">Authentication Type</FormLabel>
          <RadioGroup
            row
            value={secretType}
            onChange={e => setSecretType(e.target.value as SecretType)}
          >
            <FormControlLabel
              value="basic-auth"
              control={<Radio color="primary" />}
              label="Basic Authentication"
              disabled={loading}
            />
            <FormControlLabel
              value="ssh-auth"
              control={<Radio color="primary" />}
              label="SSH Authentication"
              disabled={loading}
            />
          </RadioGroup>
        </FormControl>

        {secretType === 'basic-auth' ? (
          <Box style={{ marginTop: 16 }}>
            <TextField
              margin="dense"
              label="Token"
              fullWidth
              variant="outlined"
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              disabled={loading}
            />
            <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
              Your git provider access token or password with repository read permissions.
            </FormHelperText>
          </Box>
        ) : (
          <Box style={{ marginTop: 16 }}>
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragging ? '2px dashed #3f51b5' : '2px dashed #ccc',
                borderRadius: 8,
                padding: 16,
                backgroundColor: isDragging ? 'rgba(63, 81, 181, 0.05)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <Box display="flex" alignItems="flex-start">
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={uploadedFileName}
                  placeholder="No file selected"
                  disabled={loading}
                  InputProps={{
                    readOnly: true,
                  }}
                />
                <input
                  style={{ display: 'none' }}
                  id="ssh-key-file-upload"
                  type="file"
                  onChange={handleFileUpload}
                  disabled={loading}
                />
                <label htmlFor="ssh-key-file-upload" style={{ marginLeft: 8 }}>
                  <Button
                    variant="outlined"
                    component="span"
                    disabled={loading}
                    style={{ whiteSpace: 'nowrap', height: 40 }}
                  >
                    Browse
                  </Button>
                </label>
              </Box>
              <Typography
                variant="caption"
                color="textSecondary"
                style={{ display: 'block', marginTop: 8 }}
              >
                Drag and drop file with your private SSH key here or browse to upload it.
              </Typography>
            </Box>

            <Box style={{ marginTop: 16 }}>
              <TextField
                margin="dense"
                label="SSH Private Key"
                fullWidth
                variant="outlined"
                multiline
                rows={8}
                value={sshKey}
                onChange={e => {
                  setSshKey(e.target.value);
                  setUploadedFileName(''); // Clear filename if user manually edits
                }}
                disabled={loading}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              />
              <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
                Your Private SSH Key file for git authentication.
              </FormHelperText>
            </Box>
          </Box>
        )}

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
          disabled={
            loading ||
            !secretName.trim() ||
            (secretType === 'basic-auth' && !token.trim()) ||
            (secretType === 'ssh-auth' && !sshKey.trim())
          }
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};