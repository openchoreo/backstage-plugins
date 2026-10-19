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
import { alpha, useTheme } from '@material-ui/core/styles';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';

type SecretType = 'basic-auth' | 'ssh-auth' | 'github-app';

interface GitSecretDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    secretName: string,
    secretType: SecretType,
    tokenOrKey: string,
    username?: string,
    sshKeyId?: string,
    appId?: string,
    installationId?: string,
    privateKey?: string,
  ) => Promise<void>;
  existingSecretNames?: string[];
}

// Dialog for creating a new git secret inline during the scaffolder flow, supporting Basic Authentication, SSH Authentication, and GitHub App credentials.
export const GitSecretDialog = ({
  open,
  onClose,
  onSubmit,
  existingSecretNames = [],
}: GitSecretDialogProps) => {
  const theme = useTheme();
  const tokens = useChoreoTokens();
  const [secretName, setSecretName] = useState('');
  const [secretType, setSecretType] = useState<SecretType>('basic-auth');
  const [token, setToken] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [username, setUsername] = useState('');
  const [sshKeyId, setSshKeyId] = useState('');
  const [appId, setAppId] = useState('');
  const [installationId, setInstallationId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
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

    // Check for duplicate name
    if (existingSecretNames.includes(secretName.trim())) {
      setError('A secret with this name already exists. Choose a unique name.');
      return;
    }

    if (secretType === 'basic-auth' && !token.trim()) {
      setError('Password or Token is required for Basic Authentication');
      return;
    }

    if (secretType === 'ssh-auth' && !sshKey.trim()) {
      setError('SSH key is required for SSH Authentication');
      return;
    }

    if (secretType === 'github-app') {
      if (!appId.trim() || !installationId.trim() || !privateKey.trim()) {
        setError('App ID, Installation ID and Private Key are required for GitHub App Authentication');
        return;
      }
    }

    // Validate secret name format (Kubernetes naming convention)
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!nameRegex.test(secretName)) {
      setError(
        'Secret name must consist of lowercase alphanumeric characters or dashes, ' +
          'start with a lowercase letter or number, and end with a lowercase letter or number.',
      );
      return;
    }

    // Validate SSH key format if SSH authentication is selected
    if (secretType === 'ssh-auth') {
      const trimmedKey = sshKey.trim();
      if (
        !trimmedKey.includes('BEGIN') ||
        !trimmedKey.includes('PRIVATE KEY')
      ) {
        setError('Invalid SSH key format. Provide a valid private key.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Format SSH key: convert multiline to single line with \n
      const formattedValue =
        secretType === 'ssh-auth'
          ? sshKey.trim().replace(/\r\n/g, '\n') // Normalize line endings
          : token.trim();

      await onSubmit(
        secretName.trim(),
        secretType,
        formattedValue,
        username.trim() || undefined,
        sshKeyId.trim() || undefined,
        appId.trim() || undefined,
        installationId.trim() || undefined,
        privateKey.trim() || undefined,
      );

      // Reset form on success
      setSecretName('');
      setToken('');
      setSshKey('');
      setUsername('');
      setSshKeyId('');
      setAppId('');
      setInstallationId('');
      setPrivateKey('');
      setSecretType('basic-auth');
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
      setUsername('');
      setSshKeyId('');
      setAppId('');
      setInstallationId('');
      setPrivateKey('');
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
      reader.onload = e => {
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
      reader.onload = e => {
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
          maxHeight: '80vh',
        },
      }}
      aria-labelledby="create-git-secret-dialog-title"
    >
      <DialogTitle id="create-git-secret-dialog-title">
        <Typography variant="h4" component="div" style={{ fontWeight: 600 }}>
          Create Git Secret
        </Typography>
      </DialogTitle>
      <DialogContent style={{ height: 500, overflowY: 'auto' }}>
        <Box style={{ marginTop: 16 }}>
          <TextField
            margin="dense"
            label="Secret Name"
            fullWidth
            variant="outlined"
            value={secretName}
            onChange={e => setSecretName(e.target.value.toLowerCase())}
            disabled={loading}
            required
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
            <FormControlLabel
              value="github-app"
              control={<Radio color="primary" />}
              label="GitHub App"
              disabled={loading}
            />
          </RadioGroup>
        </FormControl>

        {secretType === 'basic-auth' ? (
          <Box style={{ marginTop: 16 }}>
            <TextField
              margin="dense"
              label="Username"
              fullWidth
              variant="outlined"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />
            <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
              Username for git authentication.
            </FormHelperText>

            <TextField
              margin="dense"
              label="Password or Token"
              fullWidth
              variant="outlined"
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              disabled={loading}
              required
              style={{ marginTop: 16 }}
            />
            <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
              Your git provider password or access token with repository read
              permissions.
            </FormHelperText>
          </Box>
        ) : secretType === 'ssh-auth' ? (
          <Box style={{ marginTop: 16 }}>
            <TextField
              margin="dense"
              label="SSH Key ID"
              fullWidth
              variant="outlined"
              value={sshKeyId}
              onChange={e => setSshKeyId(e.target.value)}
              disabled={loading}
            />
            <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
              SSH key identifier for git authentication.
            </FormHelperText>

            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${
                  isDragging ? theme.palette.primary.main : tokens.border.subtle
                }`,
                borderRadius: 8,
                padding: 16,
                marginTop: 16,
                backgroundColor: isDragging
                  ? alpha(theme.palette.primary.main, 0.05)
                  : 'transparent',
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
                Drag and drop file with your private SSH key here or browse to
                upload it.
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
                required
              />
              <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
                Your Private SSH Key file for git authentication.
              </FormHelperText>
            </Box>
          </Box>
        ) : (
          <Box style={{ marginTop: 16 }}>
            <TextField
              margin="dense"
              label="App ID"
              fullWidth
              variant="outlined"
              value={appId}
              onChange={e => setAppId(e.target.value)}
              disabled={loading}
              required
            />
            <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
              The GitHub App ID.
            </FormHelperText>

            <TextField
              margin="dense"
              label="Installation ID"
              fullWidth
              variant="outlined"
              value={installationId}
              onChange={e => setInstallationId(e.target.value)}
              disabled={loading}
              required
              style={{ marginTop: 16 }}
            />
            <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
              The installation ID of the GitHub App on the target organization or repository.
            </FormHelperText>

            <TextField
              margin="dense"
              label="Private Key"
              fullWidth
              variant="outlined"
              multiline
              rows={8}
              value={privateKey}
              onChange={e => setPrivateKey(e.target.value)}
              disabled={loading}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              required
              style={{ marginTop: 16 }}
            />
            <FormHelperText style={{ marginLeft: 0, marginTop: 4 }}>
              The private key generated for the GitHub App, in PEM format.
            </FormHelperText>
          </Box>
        )}

        {error && (
          <Typography variant="body2" color="error" style={{ marginTop: 16 }}>
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
            (secretType === 'ssh-auth' && !sshKey.trim()) ||
            (secretType === 'github-app' &&
              (!appId.trim() || !installationId.trim() || !privateKey.trim()))
          }
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
