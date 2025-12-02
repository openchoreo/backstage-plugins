import { useState, type FC } from 'react';
import {
  TextField,
  Button,
  IconButton,
  Grid,
  Typography,
  Box,
  Collapse,
  Paper,
  Tooltip,
  Snackbar,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AttachFileIcon from '@material-ui/icons/AttachFile';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { Alert } from '@material-ui/lab';
import type { FileVar } from '@openchoreo/backstage-plugin-common';
import {
  SecretSelector,
  type SecretOption,
} from '@openchoreo/backstage-design-system';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    overflow: 'hidden',
  },
  header: {
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.grey[50],
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  content: {
    padding: theme.spacing(1.5),
  },
  contentPreview: {
    backgroundColor: theme.palette.grey[100],
    border: `1px solid ${theme.palette.grey[300]}`,
    borderRadius: 4,
    padding: theme.spacing(1),
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'pre',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  uploadActions: {
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  lockButton: {
    marginLeft: 4,
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: 8,
    padding: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: theme.palette.text.primary,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  lockButtonSecret: {
    color: theme.palette.primary.main,
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

export interface FileVarEditorProps {
  /** The file variable to edit */
  fileVar: FileVar;
  /** Unique identifier for this editor (used for file input IDs) */
  id: string;
  /** Available secrets for reference selection */
  secrets: SecretOption[];
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Current mode - 'plain' for file content, 'secret' for secret reference */
  mode: 'plain' | 'secret';
  /** Callback when any field changes */
  onChange: (field: keyof FileVar, value: any) => void;
  /** Callback when the file var should be removed */
  onRemove: () => void;
  /** Callback when mode changes */
  onModeChange: (mode: 'plain' | 'secret') => void;
}

/**
 * Editor component for a single file mount.
 * Supports both direct file content and secret references.
 * Includes file upload capability and content preview.
 *
 * @example
 * ```tsx
 * <FileVarEditor
 *   fileVar={{ key: 'config.json', mountPath: '/app/config', value: '{}' }}
 *   id="main-0"
 *   secrets={[{ name: 'my-secret', keys: ['config-data'] }]}
 *   mode="plain"
 *   onChange={(field, value) => handleChange(field, value)}
 *   onRemove={() => handleRemove()}
 *   onModeChange={(mode) => setMode(mode)}
 * />
 * ```
 */
export const FileVarEditor: FC<FileVarEditorProps> = ({
  fileVar,
  id,
  secrets,
  disabled = false,
  mode,
  onChange,
  onRemove,
  onModeChange,
}) => {
  const classes = useStyles();
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSecret = mode === 'secret';
  const hasContent = fileVar.value && fileVar.value.length > 0;

  const getContentPreview = (content: string, maxLines: number = 2): string => {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return `${lines.slice(0, maxLines).join('\n')}...`;
  };

  const handleModeChange = (newMode: 'plain' | 'secret') => {
    onModeChange(newMode);

    // Clear conflicting values when switching modes
    if (newMode === 'plain') {
      onChange('value', '');
      onChange('valueFrom', undefined);
    } else {
      onChange('value', undefined);
      onChange('valueFrom', { secretRef: { name: '', key: '' } });
    }
  };

  const handleSecretNameChange = (name: string) => {
    onChange('valueFrom', { secretRef: { name, key: '' } });
    if (name && fileVar.value) {
      onChange('value', undefined);
    }
  };

  const handleSecretKeyChange = (key: string) => {
    const currentName = fileVar.valueFrom?.secretRef?.name || '';
    onChange('valueFrom', { secretRef: { name: currentName, key } });
    if (key && fileVar.value) {
      onChange('value', undefined);
    }
  };

  const handleValueChange = (value: string) => {
    onChange('value', value);
    if (value && fileVar.valueFrom) {
      onChange('valueFrom', undefined);
    }
  };

  const handleFileUpload = (file: File, inputElement: HTMLInputElement) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        onChange('value', content);
        if (content && fileVar.valueFrom) {
          onChange('valueFrom', undefined);
        }
        if (!fileVar.key) {
          onChange('key', file.name);
        }
        inputElement.value = '';
      } catch (err) {
        setError('Error reading file. Please try again.');
        inputElement.value = '';
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. Please check the file and try again.');
      inputElement.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Paper className={classes.container}>
        <Box className={classes.header}>
          <Grid container spacing={1} alignItems="center">
            <Grid
              item
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingRight: 8,
              }}
            >
              <Tooltip
                title={
                  isSecret
                    ? 'Click to switch to file content'
                    : 'Click to switch to secret reference'
                }
              >
                <IconButton
                  onClick={() =>
                    handleModeChange(isSecret ? 'plain' : 'secret')
                  }
                  size="small"
                  disabled={disabled}
                  className={`${classes.lockButton} ${
                    isSecret ? classes.lockButtonSecret : ''
                  }`}
                  color={isSecret ? 'primary' : 'default'}
                  aria-label={
                    isSecret
                      ? 'Switch to file content'
                      : 'Switch to secret reference'
                  }
                >
                  {isSecret ? <LockIcon /> : <LockOpenIcon />}
                </IconButton>
              </Tooltip>
            </Grid>

            <Grid item xs>
              <Grid container spacing={1}>
                <Grid item xs={5}>
                  <TextField
                    label="File Name"
                    value={fileVar.key || ''}
                    onChange={e => onChange('key', e.target.value)}
                    fullWidth
                    variant="outlined"
                    size="small"
                    disabled={disabled}
                  />
                </Grid>
                <Grid item xs={5}>
                  <TextField
                    label="Mount Path"
                    value={fileVar.mountPath || ''}
                    onChange={e => onChange('mountPath', e.target.value)}
                    fullWidth
                    variant="outlined"
                    size="small"
                    disabled={disabled}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item style={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="Delete file mount">
                <IconButton
                  onClick={onRemove}
                  color="secondary"
                  size="small"
                  disabled={disabled}
                  aria-label="Delete file mount"
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Box>

        <Box className={classes.content}>
          {isSecret ? (
            <SecretSelector
              secretName={fileVar.valueFrom?.secretRef?.name || ''}
              secretKey={fileVar.valueFrom?.secretRef?.key || ''}
              secrets={secrets}
              onSecretNameChange={handleSecretNameChange}
              onSecretKeyChange={handleSecretKeyChange}
              disabled={disabled}
            />
          ) : (
            <>
              {hasContent && (
                <Box mb={1}>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="caption" color="textSecondary">
                      Content Preview
                    </Typography>
                    <Button
                      size="small"
                      startIcon={
                        isExpanded ? <VisibilityOffIcon /> : <VisibilityIcon />
                      }
                      onClick={() => setIsExpanded(!isExpanded)}
                      disabled={disabled}
                    >
                      {isExpanded ? 'Collapse Content' : 'Expand Content'}
                    </Button>
                  </Box>

                  {!isExpanded && (
                    <Box className={classes.contentPreview}>
                      {getContentPreview(fileVar.value!)}
                    </Box>
                  )}
                </Box>
              )}

              <Collapse in={isExpanded || !hasContent}>
                <TextField
                  disabled={disabled}
                  label={hasContent ? 'Edit Content' : 'Content'}
                  value={fileVar.value || ''}
                  onChange={e => handleValueChange(e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  multiline
                  minRows={hasContent ? 6 : 3}
                  placeholder="Enter file content or upload a file"
                  InputProps={{
                    style: {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                    },
                  }}
                />
              </Collapse>

              <Box className={classes.uploadActions}>
                <input
                  accept="*/*"
                  style={{ display: 'none' }}
                  id={`file-upload-${id}`}
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, e.target);
                    }
                  }}
                  disabled={disabled}
                />
                <label htmlFor={`file-upload-${id}`}>
                  <Button
                    variant="outlined"
                    component="span"
                    size="small"
                    startIcon={<AttachFileIcon />}
                    disabled={disabled}
                  >
                    Upload File
                  </Button>
                </label>
              </Box>
            </>
          )}
        </Box>
      </Paper>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};
