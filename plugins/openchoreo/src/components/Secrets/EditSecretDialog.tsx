import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import CloseIcon from '@material-ui/icons/Close';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  Secret,
  SecretType,
  UpdateSecretRequest,
} from '../../api/OpenChoreoClientApi';
import { getErrorMessage, isForbiddenError } from '../../utils/errorUtils';

interface EditSecretDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    secretName: string,
    request: UpdateSecretRequest,
  ) => Promise<Secret>;
  secret: Secret | null;
  namespaceName: string;
}

interface KeyValueRow {
  key: string;
  value: string;
  show: boolean;
  /** True if this key existed on the secret when the dialog opened. */
  isOriginal?: boolean;
}

const useStyles = makeStyles(theme => ({
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    justifyContent: 'center',
  },
  meta: {
    marginBottom: theme.spacing(2),
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  rowKey: { flex: 1 },
  rowValue: { flex: 2 },
  removeBtn: { marginTop: theme.spacing(1) },
  addLink: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
}));

const SECRET_TYPE_LABELS: Record<SecretType, string> = {
  Opaque: 'Opaque',
  'kubernetes.io/basic-auth': 'Basic Auth',
  'kubernetes.io/ssh-auth': 'SSH Auth',
  'kubernetes.io/dockerconfigjson': 'Docker Config',
  'kubernetes.io/tls': 'TLS',
};

function formatSecretType(type?: SecretType): string {
  if (!type) return 'Unknown';
  return SECRET_TYPE_LABELS[type] ?? type;
}

/** Whether the user is allowed to add/remove keys for this secret type. */
function isFixedKeySchema(type?: SecretType): boolean {
  return type !== undefined && type !== 'Opaque';
}

function decodeBase64Utf8(b64: string): string {
  if (!b64) return '';
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

export const EditSecretDialog = ({
  open,
  onClose,
  onSubmit,
  secret,
  namespaceName,
}: EditSecretDialogProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const [rows, setRows] = useState<KeyValueRow[]>([]);
  const [baseline, setBaseline] = useState<Record<string, string> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingValues, setLoadingValues] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fixedKeys = isFixedKeySchema(secret?.secretType);

  // Fetch the secret with plaintext values when the dialog opens so the user
  // can see and edit current values. Values stay in memory only and are
  // dropped when the dialog closes.
  useEffect(() => {
    if (!open || !secret) return undefined;

    let cancelled = false;
    setLoadingValues(true);
    setLoadError(null);
    setError(null);
    setBaseline(null);
    setRows(
      secret.keys.map(key => ({
        key,
        value: '',
        show: false,
        isOriginal: true,
      })),
    );

    client
      .getSecret(namespaceName, secret.name)
      .then(detail => {
        if (cancelled) return;
        // Backend forwards the K8s wire format unchanged: values are
        // base64-encoded. Decode at the UI boundary so the inputs show
        // plaintext and so dirty checks compare like-for-like.
        const decoded: Record<string, string> = {};
        for (const [k, b64] of Object.entries(detail.data ?? {})) {
          decoded[k] = decodeBase64Utf8(b64);
        }
        const orderedKeys = detail.keys.length > 0 ? detail.keys : secret.keys;
        setBaseline(
          Object.fromEntries(orderedKeys.map(key => [key, decoded[key] ?? ''])),
        );
        setRows(
          orderedKeys.map(key => ({
            key,
            value: decoded[key] ?? '',
            show: false,
            isOriginal: true,
          })),
        );
      })
      .catch(err => {
        if (cancelled) return;
        if (isForbiddenError(err)) {
          setLoadError(
            'You do not have permission to view this secret’s values.',
          );
        } else {
          setLoadError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingValues(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, secret, client, namespaceName]);

  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach(r => {
      const k = r.key.trim();
      if (!k) return;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    });
    return new Set(
      Array.from(seen.entries())
        .filter(([, c]) => c > 1)
        .map(([k]) => k),
    );
  }, [rows]);

  const isChanged = useMemo(() => {
    if (!baseline) return false;
    const baselineKeys = Object.keys(baseline);
    if (rows.length !== baselineKeys.length) return true;
    for (const row of rows) {
      const k = row.key.trim();
      if (!(k in baseline)) return true;
      if (baseline[k] !== row.value) return true;
    }
    return false;
  }, [rows, baseline]);

  const canSubmit = useMemo(() => {
    if (!secret) return false;
    if (loadingValues) return false;
    if (duplicateKeys.size > 0) return false;
    if (!isChanged) return false;
    if (rows.length === 0) return false;
    return rows.every(r => r.key.trim() !== '');
  }, [rows, duplicateKeys, secret, loadingValues, isChanged]);

  const handleRowChange = (
    index: number,
    field: 'key' | 'value',
    value: string,
  ) => {
    setRows(prev =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  };

  const toggleShow = (index: number) => {
    setRows(prev =>
      prev.map((r, i) => (i === index ? { ...r, show: !r.show } : r)),
    );
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setRows(prev => [...prev, { key: '', value: '', show: false }]);
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!secret || !canSubmit) return;
    setSubmitting(true);
    setError(null);

    const data: Record<string, string> = {};
    for (const row of rows) {
      data[row.key.trim()] = row.value;
    }

    try {
      await onSubmit(secret.name, { data });
      onClose();
    } catch (err) {
      if (isForbiddenError(err)) {
        setError(
          'You do not have permission to update this secret. Contact your administrator.',
        );
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!secret) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="edit-secret-dialog-title"
    >
      <DialogTitle disableTypography id="edit-secret-dialog-title">
        <Typography variant="h4">Edit Secret: {secret.name}</Typography>
      </DialogTitle>
      <DialogContent>
        <Box className={classes.meta}>
          <Box className={classes.metaRow}>
            <Typography variant="body2" color="textSecondary">
              Type:
            </Typography>
            <Typography variant="body2">
              {formatSecretType(secret.secretType)}
            </Typography>
          </Box>
          {secret.targetPlane && (
            <Box className={classes.metaRow}>
              <Typography variant="body2" color="textSecondary">
                Target Plane:
              </Typography>
              <Typography variant="body2">{secret.targetPlane.name}</Typography>
              <Chip
                label={secret.targetPlane.kind}
                size="small"
                variant="outlined"
              />
            </Box>
          )}
        </Box>

        {loadingValues && (
          <Box className={classes.loading}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="textSecondary">
              Loading values...
            </Typography>
          </Box>
        )}

        {loadError && (
          <Typography color="error" style={{ marginBottom: 12 }}>
            Could not load current values: {loadError}
          </Typography>
        )}

        {rows.map((row, index) => (
          <Box
            key={`${row.isOriginal ? row.key : 'new'}-${index}`}
            className={classes.row}
          >
            <TextField
              className={classes.rowKey}
              label="Key"
              variant="outlined"
              size="small"
              value={row.key}
              onChange={e => handleRowChange(index, 'key', e.target.value)}
              disabled={fixedKeys || row.isOriginal === true}
              error={duplicateKeys.has(row.key.trim())}
              helperText={
                duplicateKeys.has(row.key.trim()) ? 'Duplicate key' : undefined
              }
              inputProps={{ 'aria-label': `Key ${index + 1}` }}
            />
            <TextField
              className={classes.rowValue}
              label="Value"
              variant="outlined"
              size="small"
              type={row.show ? 'text' : 'password'}
              value={row.value}
              placeholder="••••••••"
              onChange={e => handleRowChange(index, 'value', e.target.value)}
              inputProps={{ 'aria-label': `Value ${index + 1}` }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => toggleShow(index)}
                      aria-label={row.show ? 'Hide value' : 'Show value'}
                    >
                      {row.show ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {!fixedKeys && (
              <IconButton
                size="small"
                className={classes.removeBtn}
                onClick={() => removeRow(index)}
                aria-label={`Remove ${row.key || 'row'}`}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}

        {!fixedKeys && (
          <Link
            component="button"
            type="button"
            className={classes.addLink}
            onClick={addRow}
            underline="always"
          >
            <AddIcon fontSize="small" /> Add key
          </Link>
        )}

        {error && (
          <Typography color="error" style={{ marginTop: 16 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting} variant="contained">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={!canSubmit || submitting}
          startIcon={submitting ? <CircularProgress size={20} /> : null}
        >
          {submitting ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
