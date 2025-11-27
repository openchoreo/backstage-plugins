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
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import {
  Container,
  EnvVar,
  FileVar,
} from '@openchoreo/backstage-plugin-common';
import { useBuilds } from '../WorkloadContext';
import { ImageSelector } from './ImageSelector';
import { EnvVarRow } from './EnvVarRow';
import { useState } from 'react';
import { useSecretReferences } from '../../../../hooks/useSecretReferences';
import { FileVarRow } from './FileVarRow';

interface ContainerContentProps {
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
}));

export function ContainerContent({
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
}: ContainerContentProps) {
  const classes = useStyles();
  const { builds } = useBuilds();
  const { secretReferences } = useSecretReferences();

  const containerEntries = Object.entries(containers);
  const showAddButton = !singleContainerMode || containerEntries.length === 0;

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

  return (
    <Box>
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
                  onEnvVarChange={onEnvVarChange}
                  onRemoveEnvVar={onRemoveEnvVar}
                  secretReferences={secretReferences}
                  mode={getEnvVarMode(containerName, index)}
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
                  const currentFileMode = getFileMode(containerName, index);

                  return (
                    <FileVarRow
                      key={index}
                      fileVar={fileVar}
                      index={index}
                      containerName={containerName}
                      disabled={disabled}
                      secretReferences={secretReferences}
                      mode={currentFileMode}
                      isExpanded={isExpanded}
                      onFileVarChange={onFileVarChange}
                      onRemoveFileVar={onRemoveFileVar}
                      onModeChange={setFileMode}
                      onCleanupModes={cleanupFileModes}
                      onToggleExpanded={toggleFileExpanded}
                      getSecretKeys={getSecretKeys}
                    />
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
  );
}
