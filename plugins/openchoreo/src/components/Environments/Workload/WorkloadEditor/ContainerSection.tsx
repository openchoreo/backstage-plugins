import {
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Grid,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Collapse,
  Paper,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AttachFileIcon from '@material-ui/icons/AttachFile';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { useState } from 'react';
import {
  Container,
  EnvVar,
  FileVar,
} from '@openchoreo/backstage-plugin-common';
import { useBuilds, useSecretReferences } from '../WorkloadContext';
import { ImageSelector } from './ImageSelector';
import { EnvVarRow } from './EnvVarRow';

interface ContainerSectionProps {
  containers: { [key: string]: Container };
  onContainerChange: (
    containerName: string,
    field: keyof Container,
    value: string | string[],
  ) => void;
  onEnvVarChange: (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => void;
  onFileVarChange: (
    containerName: string,
    fileIndex: number,
    field: keyof FileVar,
    value: string,
  ) => void;
  onAddContainer: () => void;
  onRemoveContainer: (containerName: string) => void;
  onAddEnvVar: (containerName: string) => void;
  onRemoveEnvVar: (containerName: string, envIndex: number) => void;
  onAddFileVar: (containerName: string) => void;
  onRemoveFileVar: (containerName: string, fileIndex: number) => void;
  onArrayFieldChange: (
    containerName: string,
    field: 'command' | 'args',
    value: string,
  ) => void;
  disabled: boolean;
  singleContainerMode: boolean;
  hideContainerFields?: boolean;
}

const useStyles = makeStyles(theme => ({
  accordion: {
    border: 'none',
    marginBottom: theme.spacing(0),
    borderRadius: 8,
    boxShadow: 'none',
    backgroundColor: 'transparent',
    '&:before': { backgroundColor: 'transparent' },
  },
  containerCard: {
    padding: theme.spacing(0),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
  envVarContainer: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
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
}));

export function ContainerSection({
  containers,
  onContainerChange,
  onEnvVarChange,
  onAddContainer,
  onRemoveContainer,
  onAddEnvVar,
  onRemoveEnvVar,
  onArrayFieldChange,
  onFileVarChange,
  onAddFileVar,
  onRemoveFileVar,
  disabled,
  singleContainerMode,
  hideContainerFields = false,
}: ContainerSectionProps) {
  const classes = useStyles();
  const { builds } = useBuilds();
  const { secretReferences } = useSecretReferences();

  const containerEntries = Object.entries(containers);
  const showAddButton = !singleContainerMode || containerEntries.length === 0;

  const getContentPreview = (content: string, maxLines: number = 2): string => {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return lines.slice(0, maxLines).join('\n') + '...';
  };

  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(
    {},
  );
  const [envValueMode, setEnvValueMode] = useState<
    Record<string, 'plain' | 'secret'>
  >({});
  const [fileValueMode, setFileValueMode] = useState<
    Record<string, 'plain' | 'secret'>
  >({});

  const toggleFileExpanded = (containerName: string, fileIndex: number) => {
    const key = `${containerName}-${fileIndex}`;
    setExpandedFiles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getEnvVarMode = (
    containerName: string,
    envIndex: number,
  ): 'plain' | 'secret' => {
    const key = `${containerName}-${envIndex}`;
    const container = containers[containerName];
    const envVar = container?.env?.[envIndex];

    if (envVar?.valueFrom?.secretRef) {
      return 'secret';
    }

    return envValueMode[key] || 'plain';
  };

  const setEnvVarMode = (
    containerName: string,
    envIndex: number,
    mode: 'plain' | 'secret',
  ) => {
    const key = `${containerName}-${envIndex}`;
    setEnvValueMode(prev => ({ ...prev, [key]: mode }));

    // Clear the current value when switching modes
    const container = containers[containerName];
    const envVar = container?.env?.[envIndex];
    if (envVar) {
      if (mode === 'plain') {
        onEnvVarChange(containerName, envIndex, 'value', '');
        onEnvVarChange(containerName, envIndex, 'valueFrom', undefined as any);
      } else {
        onEnvVarChange(containerName, envIndex, 'value', undefined as any);
        onEnvVarChange(containerName, envIndex, 'valueFrom', {
          secretRef: { name: '', key: '' },
        } as any);
      }
    }
  };

  const cleanupEnvVarModes = (containerName: string, removedIndex: number) => {
    setEnvValueMode(prev => {
      const newState = { ...prev };
      
      // Remove the mode for the deleted env var
      delete newState[`${containerName}-${removedIndex}`];
      
      // Shift modes for env vars that came after the removed one
      const container = containers[containerName];
      const envCount = container?.env?.length || 0;
      
      for (let i = removedIndex + 1; i <= envCount; i++) {
        const oldKey = `${containerName}-${i}`;
        const newKey = `${containerName}-${i - 1}`;
        
        if (newState[oldKey]) {
          newState[newKey] = newState[oldKey];
          delete newState[oldKey];
        }
      }
      
      return newState;
    });
  };

  const getSecretKeys = (secretName: string): string[] => {
    const secret = secretReferences.find(ref => ref.name === secretName);
    return secret?.data?.map(item => item.secretKey) || [];
  };

  const getFileMode = (
    containerName: string,
    fileIndex: number,
  ): 'plain' | 'secret' => {
    const key = `${containerName}-${fileIndex}`;
    const container = containers[containerName];
    const fileVar = (container as any).files?.[fileIndex];

    if (fileVar?.valueFrom?.secretRef) {
      return 'secret';
    }

    return fileValueMode[key] || 'plain';
  };

  const setFileMode = (
    containerName: string,
    fileIndex: number,
    mode: 'plain' | 'secret',
  ) => {
    const key = `${containerName}-${fileIndex}`;
    setFileValueMode(prev => ({ ...prev, [key]: mode }));

    // Clear the current value when switching modes
    const container = containers[containerName];
    const fileVar = (container as any).files?.[fileIndex];
    if (fileVar) {
      if (mode === 'plain') {
        onFileVarChange(containerName, fileIndex, 'value', '');
        onFileVarChange(
          containerName,
          fileIndex,
          'valueFrom',
          undefined as any,
        );
      } else {
        onFileVarChange(containerName, fileIndex, 'value', undefined as any);
        onFileVarChange(containerName, fileIndex, 'valueFrom', {
          secretRef: { name: '', key: '' },
        } as any);
      }
    }
  };

  const cleanupFileModes = (containerName: string, removedIndex: number) => {
    setFileValueMode(prev => {
      const newState = { ...prev };
      
      // Remove the mode for the deleted file
      delete newState[`${containerName}-${removedIndex}`];
      
      // Shift modes for files that came after the removed one
      const container = containers[containerName];
      const fileCount = (container as any).files?.length || 0;
      
      for (let i = removedIndex + 1; i <= fileCount; i++) {
        const oldKey = `${containerName}-${i}`;
        const newKey = `${containerName}-${i - 1}`;
        
        if (newState[oldKey]) {
          newState[newKey] = newState[oldKey];
          delete newState[oldKey];
        }
      }
      
      return newState;
    });
  };

  const cleanupContainerModes = (containerName: string) => {
    setEnvValueMode(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(key => {
        if (key.startsWith(`${containerName}-`)) {
          delete newState[key];
        }
      });
      return newState;
    });

    setFileValueMode(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(key => {
        if (key.startsWith(`${containerName}-`)) {
          delete newState[key];
        }
      });
      return newState;
    });

    setExpandedFiles(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(key => {
        if (key.startsWith(`${containerName}-`)) {
          delete newState[key];
        }
      });
      return newState;
    });
  };

  const handleFileUpload = (
    file: File,
    containerName: string,
    index: number,
    fileVar: FileVar,
    inputElement: HTMLInputElement
  ) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        onFileVarChange(containerName, index, 'value', content);
        if (!fileVar.key) {
          onFileVarChange(containerName, index, 'key', file.name);
        }
        inputElement.value = '';
      } catch (error) {
        console.error('Error reading file:', error);
        inputElement.value = '';
      }
    };
    reader.onerror = () => {
      console.error('Error reading file');
      inputElement.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <Accordion className={classes.accordion} defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">
          Containers ({containerEntries.length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box width="100%">
          {containerEntries.map(([containerName, container]) => (
            <Card key={containerName} className={classes.containerCard}>
              <CardHeader
                style={{ paddingBottom: 8 }}
                title={
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                      {containerName === 'main' ? 'app' : containerName}
                    </Typography>
                    <IconButton
                      onClick={() => {
                        cleanupContainerModes(containerName);
                        onRemoveContainer(containerName);
                      }}
                      color="secondary"
                      size="small"
                      disabled={disabled}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              />
              <CardContent style={{ paddingTop: 8 }}>
                <Grid container spacing={2}>
                  {!hideContainerFields && (
                    <>
                      <Grid item xs={12}>
                        <Box mb={2}>
                          <ImageSelector
                            image={container.image}
                            builds={builds}
                            disabled={disabled}
                            onChange={value =>
                              onContainerChange(containerName, 'image', value)
                            }
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Command"
                          value={container.command?.join(', ') || ''}
                          onChange={e =>
                            onArrayFieldChange(
                              containerName,
                              'command',
                              e.target.value,
                            )
                          }
                          fullWidth
                          variant="outlined"
                          placeholder="Comma-separated commands"
                          helperText="Separate multiple commands with commas"
                          disabled={disabled}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Arguments"
                          value={container.args?.join(', ') || ''}
                          onChange={e =>
                            onArrayFieldChange(
                              containerName,
                              'args',
                              e.target.value,
                            )
                          }
                          fullWidth
                          variant="outlined"
                          placeholder="Comma-separated arguments"
                          helperText="Separate multiple arguments with commas"
                          disabled={disabled}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>

                {/* Environment Variables */}
                <Box mt={3}>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    style={{ fontWeight: 600 }}
                  >
                    Environment Variables
                  </Typography>
                  {container.env?.map((envVar, index) => (
                    <EnvVarRow
                      key={index}
                      envVar={envVar}
                      index={index}
                      containerName={containerName}
                      disabled={disabled}
                      className={classes.envVarContainer}
                      secretReferences={secretReferences}
                      mode={getEnvVarMode(containerName, index)}
                      onEnvVarChange={onEnvVarChange}
                      onRemoveEnvVar={onRemoveEnvVar}
                      onModeChange={setEnvVarMode}
                      onCleanupModes={cleanupEnvVarModes}
                      getSecretKeys={getSecretKeys}
                    />
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => onAddEnvVar(containerName)}
                    variant="outlined"
                    size="small"
                    className={classes.addButton}
                    disabled={disabled}
                    color="primary"
                  >
                    Add Environment Variable
                  </Button>
                </Box>
                <Box mt={3}>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    style={{ fontWeight: 600 }}
                  >
                    File Mounts
                  </Typography>
                  {(container as any).files?.map(
                    (fileVar: FileVar, index: number) => {
                      const isExpanded =
                        expandedFiles[`${containerName}-${index}`] || false;
                      const hasContent =
                        fileVar.value && fileVar.value.length > 0;
                      const currentFileMode = getFileMode(containerName, index);
                      const isSecret = currentFileMode === 'secret';

                      return (
                        <Paper
                          key={index}
                          className={classes.fileMountContainer}
                        >
                          <Box className={classes.fileMountHeader}>
                            <Grid container spacing={1} alignItems="center">
                              <Grid item style={{ display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
                                <Tooltip title={isSecret ? 'Switch to file content' : 'Switch to secret reference'}>
                                  <IconButton
                                    onClick={() => setFileMode(containerName, index, isSecret ? 'plain' : 'secret')}
                                    size="small"
                                    disabled={disabled}
                                    color={isSecret ? 'primary' : 'default'}
                                    style={{ marginLeft: '4px' }}
                                  >
                                    {isSecret ? <LockIcon /> : <LockOpenIcon />}
                                  </IconButton>
                                </Tooltip>
                              </Grid>

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

                              <Grid item xs={2} style={{ display: 'flex', justifyContent: 'flex-end', paddingLeft: '16px' }}>
                                <Tooltip title="Delete file mount">
                                  <IconButton
                                    onClick={() => {
                                      cleanupFileModes(containerName, index);
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
                                    <InputLabel>Secret Name</InputLabel>
                                    <Select
                                      value={fileVar.valueFrom?.secretRef?.name || ''}
                                      onChange={e => {
                                        const secretName = e.target.value as string;
                                        onFileVarChange(containerName, index, 'valueFrom', { 
                                          secretRef: { name: secretName, key: '' } 
                                        } as any);
                                      }}
                                      label="Secret Name"
                                      disabled={disabled}
                                    >
                                      <MenuItem value="">
                                        <em>Select a secret</em>
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
                                    <InputLabel>Secret Key</InputLabel>
                                    <Select
                                      value={fileVar.valueFrom?.secretRef?.key || ''}
                                      onChange={e => {
                                        const secretKey = e.target.value as string;
                                        const currentSecret = fileVar.valueFrom?.secretRef?.name || '';
                                        onFileVarChange(containerName, index, 'valueFrom', { 
                                          secretRef: { name: currentSecret, key: secretKey } 
                                        } as any);
                                      }}
                                      label="Secret Key"
                                      disabled={disabled || !fileVar.valueFrom?.secretRef?.name}
                                    >
                                      <MenuItem value="">
                                        <em>Select a key</em>
                                      </MenuItem>
                                      {getSecretKeys(fileVar.valueFrom?.secretRef?.name || '').map(key => (
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
                                      <Typography
                                        variant="caption"
                                        color="textSecondary"
                                      >
                                        Content Preview
                                      </Typography>
                                      <Button
                                        size="small"
                                        startIcon={
                                          isExpanded ? (
                                            <VisibilityOffIcon />
                                          ) : (
                                            <VisibilityIcon />
                                          )
                                        }
                                        onClick={() =>
                                          toggleFileExpanded(
                                            containerName,
                                            index,
                                          )
                                        }
                                        disabled={disabled}
                                      >
                                        {isExpanded ? 'Collapse' : 'Expand'}{' '}
                                        Content
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
                                    label={
                                      hasContent ? 'Edit Content' : 'Content'
                                    }
                                    value={fileVar.value || ''}
                                    onChange={e =>
                                      onFileVarChange(
                                        containerName,
                                        index,
                                        'value',
                                        e.target.value,
                                      )
                                    }
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
                                        handleFileUpload(file, containerName, index, fileVar, e.target);
                                      }
                                    }}
                                    disabled={disabled}
                                  />
                                  <label
                                    htmlFor={`file-upload-${containerName}-${index}`}
                                  >
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
                      );
                    },
                  )}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => onAddFileVar(containerName)}
                    variant="outlined"
                    size="small"
                    className={classes.addButton}
                    disabled={disabled}
                    color="primary"
                  >
                    Add File Mount
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}

          {showAddButton && (
            <Button
              startIcon={<AddIcon />}
              onClick={onAddContainer}
              variant="contained"
              color="primary"
              className={classes.addButton}
              disabled={disabled}
            >
              Add Container
            </Button>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
