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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AttachFileIcon from '@material-ui/icons/AttachFile';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { Alert } from '@material-ui/lab';
import { useState } from 'react';
import { FileVar } from '@openchoreo/backstage-plugin-common';

interface SecretReference {
  name: string;
  displayName?: string;
  data?: Array<{ secretKey: string }>;
}

interface FileVarRowProps {
  fileVar: FileVar;
  index: number;
  containerName: string;
  disabled: boolean;
  className?: string;
  secretReferences: SecretReference[];
  mode: 'plain' | 'secret';
  isExpanded: boolean;
  onFileVarChange: (
    containerName: string,
    fileIndex: number,
    field: keyof FileVar,
    value: string,
  ) => void;
  onRemoveFileVar: (containerName: string, fileIndex: number) => void;
  onModeChange: (
    containerName: string,
    fileIndex: number,
    mode: 'plain' | 'secret',
  ) => void;
  onCleanupModes: (containerName: string, removedIndex: number) => void;
  onToggleExpanded: (containerName: string, fileIndex: number) => void;
  getSecretKeys: (secretName: string) => string[];
}

const useStyles = makeStyles(theme => ({
  fileMountContainer: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    overflow: 'hidden',
  },
  fileMountHeader: {
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.grey[50],
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  fileMountContent: {
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
    marginLeft: '4px',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '8px',
    padding: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: '#000000',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  },
  lockButtonSecret: {
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    color: theme.palette.primary.main,
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

export function FileVarRow({
  fileVar,
  index,
  containerName,
  disabled,
  secretReferences,
  mode,
  isExpanded,
  onFileVarChange,
  onRemoveFileVar,
  onModeChange,
  onCleanupModes,
  onToggleExpanded,
  getSecretKeys,
}: FileVarRowProps) {
  const classes = useStyles();
  const isSecret = mode === 'secret';
  const hasContent = fileVar.value && fileVar.value.length > 0;
  const [error, setError] = useState<string | null>(null);

  const getContentPreview = (content: string, maxLines: number = 2): string => {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return `${lines.slice(0, maxLines).join('\n')}...`;
  };

  const handleFileUpload = (file: File, inputElement: HTMLInputElement) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        onFileVarChange(containerName, index, 'value', content);
        // Clear valueFrom when setting value from file upload
        if (content && fileVar.valueFrom) {
          onFileVarChange(containerName, index, 'valueFrom', undefined as any);
        }
        if (!fileVar.key) {
          onFileVarChange(containerName, index, 'key', file.name);
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
      <Paper className={classes.fileMountContainer}>
        <Box className={classes.fileMountHeader}>
          <Grid container spacing={1} alignItems="center">
            <Grid
              item
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingRight: '8px',
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
                    onModeChange(
                      containerName,
                      index,
                      isSecret ? 'plain' : 'secret',
                    )
                  }
                  size="small"
                  disabled={disabled}
                  className={`${classes.lockButton} ${
                    isSecret ? classes.lockButtonSecret : ''
                  }`}
                  color={isSecret ? 'primary' : 'default'}
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
                    onChange={e =>
                      onFileVarChange(
                        containerName,
                        index,
                        'key',
                        e.target.value,
                      )
                    }
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
                    onChange={e =>
                      onFileVarChange(
                        containerName,
                        index,
                        'mountPath',
                        e.target.value,
                      )
                    }
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
                  onClick={() => {
                    onCleanupModes(containerName, index);
                    onRemoveFileVar(containerName, index);
                  }}
                  color="secondary"
                  size="small"
                  disabled={disabled}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Box>

        <Box className={classes.fileMountContent}>
          {isSecret ? (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Secret Reference Name</InputLabel>
                  <Select
                    value={fileVar.valueFrom?.secretRef?.name || ''}
                    onChange={e => {
                      const secretName = e.target.value as string;
                      const valueFrom = {
                        secretRef: { name: secretName, key: '' },
                      } as any;
                      onFileVarChange(
                        containerName,
                        index,
                        'valueFrom',
                        valueFrom,
                      );
                      // Clear value when setting valueFrom
                      if (secretName && fileVar.value) {
                        onFileVarChange(
                          containerName,
                          index,
                          'value',
                          undefined as any,
                        );
                      }
                    }}
                    label="Secret Reference Name"
                    disabled={disabled}
                  >
                    <MenuItem value="">
                      <em>Select a secret reference</em>
                    </MenuItem>
                    {secretReferences.map(secret => (
                      <MenuItem key={secret.name} value={secret.name}>
                        {secret.displayName || secret.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Secret Reference Key</InputLabel>
                  <Select
                    value={fileVar.valueFrom?.secretRef?.key || ''}
                    onChange={e => {
                      const secretKey = e.target.value as string;
                      const currentSecret =
                        fileVar.valueFrom?.secretRef?.name || '';
                      const valueFrom = {
                        secretRef: { name: currentSecret, key: secretKey },
                      } as any;
                      onFileVarChange(
                        containerName,
                        index,
                        'valueFrom',
                        valueFrom,
                      );
                      // Clear value when setting valueFrom
                      if (secretKey && fileVar.value) {
                        onFileVarChange(
                          containerName,
                          index,
                          'value',
                          undefined as any,
                        );
                      }
                    }}
                    label="Secret Reference Key"
                    disabled={disabled || !fileVar.valueFrom?.secretRef?.name}
                  >
                    <MenuItem value="">
                      <em>Select a key</em>
                    </MenuItem>
                    {getSecretKeys(
                      fileVar.valueFrom?.secretRef?.name || '',
                    ).map(key => (
                      <MenuItem key={key} value={key}>
                        {key}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
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
                      onClick={() => onToggleExpanded(containerName, index)}
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
                  onChange={e => {
                    const newValue = e.target.value;
                    onFileVarChange(containerName, index, 'value', newValue);
                    // Clear valueFrom when setting value
                    if (newValue && fileVar.valueFrom) {
                      onFileVarChange(
                        containerName,
                        index,
                        'valueFrom',
                        undefined as any,
                      );
                    }
                  }}
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
                  id={`file-upload-${containerName}-${index}`}
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, e.target);
                    }
                  }}
                  disabled={disabled}
                />
                <label htmlFor={`file-upload-${containerName}-${index}`}>
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
}
