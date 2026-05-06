import { useEffect, useMemo, useState } from 'react';
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
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Link,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import CloseIcon from '@material-ui/icons/Close';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import {
  CreateSecretRequest,
  Secret,
  SecretType,
  TargetPlaneKind,
} from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';

export interface TargetPlaneOption {
  name: string;
  kind: TargetPlaneKind;
}

interface CreateSecretDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: CreateSecretRequest) => Promise<Secret>;
  namespaceName: string;
  existingSecretNames?: string[];
  targetPlanes?: TargetPlaneOption[];
  targetPlanesLoading?: boolean;
}

interface KeyValueRow {
  key: string;
  value: string;
  show: boolean;
}

const useStyles = makeStyles(theme => ({
  field: {
    marginBottom: theme.spacing(2),
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  rowKey: { flex: 1 },
  rowValue: { flex: 2 },
  removeBtn: {
    marginTop: theme.spacing(1),
  },
  sectionLabel: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  addLink: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
}));

const SECRET_TYPE = {
  OPAQUE: 'Opaque',
  BASIC_AUTH: 'kubernetes.io/basic-auth',
  SSH_AUTH: 'kubernetes.io/ssh-auth',
  DOCKER_CONFIG: 'kubernetes.io/dockerconfigjson',
  TLS: 'kubernetes.io/tls',
} as const satisfies Record<string, SecretType>;

const SECRET_TYPES: {
  value: SecretType;
  label: string;
  description: string;
}[] = [
  {
    value: SECRET_TYPE.OPAQUE,
    label: 'Opaque',
    description: 'Free-form key/value pairs',
  },
  {
    value: SECRET_TYPE.BASIC_AUTH,
    label: 'Basic Auth',
    description: 'Username and password/token',
  },
  {
    value: SECRET_TYPE.SSH_AUTH,
    label: 'SSH Auth',
    description: 'Private SSH key',
  },
  {
    value: SECRET_TYPE.DOCKER_CONFIG,
    label: 'Docker Config',
    description: 'Container registry credentials',
  },
  {
    value: SECRET_TYPE.TLS,
    label: 'TLS',
    description: 'Certificate and private key',
  },
];

const KUBE_NAME_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export const CreateSecretDialog = ({
  open,
  onClose,
  onSubmit,
  namespaceName,
  existingSecretNames = [],
  targetPlanes = [],
  targetPlanesLoading = false,
}: CreateSecretDialogProps) => {
  const classes = useStyles();

  const [secretName, setSecretName] = useState('');
  const [secretType, setSecretType] = useState<SecretType>(SECRET_TYPE.OPAQUE);
  const [selectedPlaneIndex, setSelectedPlaneIndex] = useState<number | ''>('');
  const [opaqueRows, setOpaqueRows] = useState<KeyValueRow[]>([
    { key: '', value: '', show: false },
  ]);
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');
  const [showBasicPassword, setShowBasicPassword] = useState(false);
  const [sshKey, setSshKey] = useState('');
  const [dockerConfig, setDockerConfig] = useState('');
  const [tlsCrt, setTlsCrt] = useState('');
  const [tlsKey, setTlsKey] = useState('');
  const [showTlsKey, setShowTlsKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectivePlaneIndex =
    selectedPlaneIndex === '' && targetPlanes.length > 0
      ? 0
      : selectedPlaneIndex;

  // Reset on open
  useEffect(() => {
    if (open) {
      setSecretName('');
      setSecretType(SECRET_TYPE.OPAQUE);
      setSelectedPlaneIndex('');
      setOpaqueRows([{ key: '', value: '', show: false }]);
      setBasicUsername('');
      setBasicPassword('');
      setSshKey('');
      setDockerConfig('');
      setTlsCrt('');
      setTlsKey('');
      setError(null);
    }
  }, [open]);

  const updateRow = (index: number, patch: Partial<KeyValueRow>) => {
    setOpaqueRows(rows =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };
  const addRow = () => {
    setOpaqueRows(rows => [...rows, { key: '', value: '', show: false }]);
  };
  const removeRow = (index: number) => {
    setOpaqueRows(rows =>
      rows.length === 1
        ? [{ key: '', value: '', show: false }]
        : rows.filter((_, i) => i !== index),
    );
  };

  const buildData = ():
    | { ok: true; data: Record<string, string> }
    | {
        ok: false;
        error: string;
      } => {
    switch (secretType) {
      case SECRET_TYPE.OPAQUE: {
        const data: Record<string, string> = {};
        const seen = new Set<string>();
        for (const row of opaqueRows) {
          const k = row.key.trim();
          if (!k && !row.value) continue;
          if (!k) return { ok: false, error: 'All keys must have a name' };
          if (seen.has(k)) return { ok: false, error: `Duplicate key: ${k}` };
          if (!row.value)
            return { ok: false, error: `Value for "${k}" is required` };
          seen.add(k);
          data[k] = row.value;
        }
        if (Object.keys(data).length === 0) {
          return {
            ok: false,
            error: 'At least one key/value pair is required',
          };
        }
        return { ok: true, data };
      }
      case SECRET_TYPE.BASIC_AUTH: {
        if (!basicPassword) return { ok: false, error: 'Password is required' };
        const data: Record<string, string> = { password: basicPassword };
        if (basicUsername) data.username = basicUsername;
        return { ok: true, data };
      }
      case SECRET_TYPE.SSH_AUTH: {
        if (!sshKey.trim())
          return { ok: false, error: 'SSH private key is required' };
        return { ok: true, data: { 'ssh-privatekey': sshKey } };
      }
      case SECRET_TYPE.DOCKER_CONFIG: {
        if (!dockerConfig.trim())
          return { ok: false, error: 'Docker config JSON is required' };
        try {
          JSON.parse(dockerConfig);
        } catch {
          return { ok: false, error: 'Docker config must be valid JSON' };
        }
        return { ok: true, data: { '.dockerconfigjson': dockerConfig } };
      }
      case SECRET_TYPE.TLS: {
        if (!tlsCrt.trim())
          return { ok: false, error: 'TLS certificate is required' };
        if (!tlsKey.trim())
          return { ok: false, error: 'TLS private key is required' };
        return { ok: true, data: { 'tls.crt': tlsCrt, 'tls.key': tlsKey } };
      }
      default:
        return { ok: false, error: 'Unsupported secret type' };
    }
  };

  const nameError = useMemo(() => {
    const name = secretName.trim();
    if (!name) return null;
    if (!KUBE_NAME_RE.test(name)) {
      return 'Lowercase letters, numbers, and dashes only';
    }
    if (existingSecretNames.includes(name)) {
      return 'A secret with this name already exists';
    }
    return null;
  }, [secretName, existingSecretNames]);

  const handleSubmit = async () => {
    const name = secretName.trim();
    if (!name) {
      setError('Secret name is required');
      return;
    }
    if (nameError) {
      setError(nameError);
      return;
    }
    if (targetPlanes.length === 0) {
      setError('No target planes available');
      return;
    }
    if (effectivePlaneIndex === '') {
      setError('Target plane is required');
      return;
    }
    const plane = targetPlanes[effectivePlaneIndex as number];

    const built = buildData();
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        secretName: name,
        secretType,
        targetPlane: { kind: plane.kind, name: plane.name },
        data: built.data,
      });
      onClose();
    } catch (err) {
      if (isForbiddenError(err)) {
        setError(
          'You do not have permission to create secrets in this namespace.',
        );
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const renderDataSection = () => {
    switch (secretType) {
      case SECRET_TYPE.OPAQUE:
        return (
          <Box>
            <Typography variant="subtitle2" className={classes.sectionLabel}>
              Data
            </Typography>
            {opaqueRows.map((row, index) => (
              <Box key={index} className={classes.row}>
                <TextField
                  className={classes.rowKey}
                  label="Key"
                  variant="outlined"
                  size="small"
                  value={row.key}
                  onChange={e => updateRow(index, { key: e.target.value })}
                />
                <TextField
                  className={classes.rowValue}
                  label="Value"
                  variant="outlined"
                  size="small"
                  type={row.show ? 'text' : 'password'}
                  value={row.value}
                  onChange={e => updateRow(index, { value: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => updateRow(index, { show: !row.show })}
                          tabIndex={-1}
                        >
                          {row.show ? (
                            <VisibilityOffIcon />
                          ) : (
                            <VisibilityIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <IconButton
                  size="small"
                  className={classes.removeBtn}
                  onClick={() => removeRow(index)}
                  aria-label="Remove key"
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            ))}
            <Link className={classes.addLink} onClick={addRow} color="primary">
              <AddIcon fontSize="small" /> Add key
            </Link>
          </Box>
        );
      case SECRET_TYPE.BASIC_AUTH:
        return (
          <>
            <TextField
              className={classes.field}
              label="Username"
              variant="outlined"
              size="small"
              fullWidth
              value={basicUsername}
              onChange={e => setBasicUsername(e.target.value)}
            />
            <TextField
              className={classes.field}
              label="Password / Token"
              variant="outlined"
              size="small"
              fullWidth
              required
              type={showBasicPassword ? 'text' : 'password'}
              value={basicPassword}
              onChange={e => setBasicPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowBasicPassword(s => !s)}
                      tabIndex={-1}
                    >
                      {showBasicPassword ? (
                        <VisibilityOffIcon />
                      ) : (
                        <VisibilityIcon />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        );
      case SECRET_TYPE.SSH_AUTH:
        return (
          <TextField
            className={classes.field}
            label="SSH Private Key"
            variant="outlined"
            size="small"
            fullWidth
            required
            multiline
            minRows={6}
            value={sshKey}
            onChange={e => setSshKey(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
          />
        );
      case SECRET_TYPE.DOCKER_CONFIG:
        return (
          <TextField
            className={classes.field}
            label=".dockerconfigjson"
            variant="outlined"
            size="small"
            fullWidth
            required
            multiline
            minRows={6}
            value={dockerConfig}
            onChange={e => setDockerConfig(e.target.value)}
            placeholder='{"auths":{"registry.example.com":{"auth":"..."}}}'
          />
        );
      case SECRET_TYPE.TLS:
        return (
          <>
            <TextField
              className={classes.field}
              label="tls.crt"
              variant="outlined"
              size="small"
              fullWidth
              required
              multiline
              minRows={4}
              value={tlsCrt}
              onChange={e => setTlsCrt(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----"
            />
            <TextField
              className={classes.field}
              label="tls.key"
              variant="outlined"
              size="small"
              fullWidth
              required
              multiline
              minRows={4}
              type={showTlsKey ? 'text' : 'password'}
              value={tlsKey}
              onChange={e => setTlsKey(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowTlsKey(s => !s)}
                      tabIndex={-1}
                    >
                      {showTlsKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle disableTypography>
        <Typography variant="h4">Create Secret</Typography>
        <Typography variant="body2" color="textSecondary">
          Create a new secret in namespace <strong>{namespaceName}</strong>.
        </Typography>
      </DialogTitle>
      <DialogContent>
        <TextField
          className={classes.field}
          label="Secret Name"
          variant="outlined"
          size="small"
          fullWidth
          required
          value={secretName}
          onChange={e => setSecretName(e.target.value)}
          error={!!nameError}
          helperText={nameError ?? 'Lowercase letters, numbers, dashes.'}
        />

        <FormControl
          variant="outlined"
          size="small"
          fullWidth
          className={classes.field}
        >
          <InputLabel id="target-plane-label">Target Plane</InputLabel>
          <Select
            labelId="target-plane-label"
            label="Target Plane"
            value={effectivePlaneIndex}
            onChange={e => setSelectedPlaneIndex(e.target.value as number)}
            disabled={
              loading || targetPlanesLoading || targetPlanes.length === 0
            }
          >
            {targetPlanesLoading && (
              <MenuItem disabled value="">
                <CircularProgress size={16} style={{ marginRight: 8 }} />
                Loading planes...
              </MenuItem>
            )}
            {!targetPlanesLoading && targetPlanes.length === 0 && (
              <MenuItem disabled value="">
                No target planes available
              </MenuItem>
            )}
            {!targetPlanesLoading &&
              targetPlanes.map((plane, index) => (
                <MenuItem key={`${plane.kind}/${plane.name}`} value={index}>
                  {plane.name} ({plane.kind})
                </MenuItem>
              ))}
          </Select>
          <FormHelperText>Where this secret will be delivered.</FormHelperText>
        </FormControl>

        <FormControl component="fieldset" className={classes.field}>
          <FormLabel component="legend">Secret Type</FormLabel>
          <RadioGroup
            value={secretType}
            onChange={e => setSecretType(e.target.value as SecretType)}
          >
            {SECRET_TYPES.map(t => (
              <FormControlLabel
                key={t.value}
                value={t.value}
                control={<Radio color="primary" />}
                label={
                  <Box>
                    <Typography variant="body2">{t.label}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {t.description}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </FormControl>

        {renderDataSection()}

        {error && (
          <Typography color="error" style={{ marginTop: 16 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading} variant="contained">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={
            loading ||
            !secretName.trim() ||
            !!nameError ||
            (targetPlanes.length > 0 && effectivePlaneIndex === '')
          }
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
