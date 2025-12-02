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
  ModelsBuild,
} from '@openchoreo/backstage-plugin-common';
import {
  ImageSelector,
  EnvVarEditor,
  FileVarEditor,
  useModeState,
  type SecretReference,
} from '@openchoreo/backstage-plugin-react';
import type { SecretOption } from '@openchoreo/backstage-design-system';

export interface ContainerContentProps {
  /** Map of container name to container configuration */
  containers: { [key: string]: Container };
  /** Callback when a container field changes */
  onContainerChange: (
    containerName: string,
    field: keyof Container,
    value: string | string[],
  ) => void;
  /** Callback when an environment variable field changes */
  onEnvVarChange: (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => void;
  /** Callback when a file mount field changes */
  onFileVarChange: (
    containerName: string,
    fileIndex: number,
    field: keyof FileVar,
    value: string,
  ) => void;
  /** Callback when a new container should be added */
  onAddContainer: () => void;
  /** Callback when a container should be removed */
  onRemoveContainer: (containerName: string) => void;
  /** Callback when a new environment variable should be added */
  onAddEnvVar: (containerName: string) => void;
  /** Callback when an environment variable should be removed */
  onRemoveEnvVar: (containerName: string, envIndex: number) => void;
  /** Callback when a new file mount should be added */
  onAddFileVar: (containerName: string) => void;
  /** Callback when a file mount should be removed */
  onRemoveFileVar: (containerName: string, fileIndex: number) => void;
  /** Callback when an array field (command, args) changes */
  onArrayFieldChange: (
    containerName: string,
    field: 'command' | 'args',
    value: string,
  ) => void;
  /** Whether the editor is disabled */
  disabled: boolean;
  /** Whether only a single container is allowed */
  singleContainerMode: boolean;
  /** Whether to hide container fields (image, command, args) */
  hideContainerFields?: boolean;
  /** Available builds for image selection (optional) */
  builds?: ModelsBuild[];
  /** Available secret references (optional) */
  secretReferences?: SecretReference[];
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
}));

/**
 * Component for editing container configurations including image, command, args,
 * environment variables, and file mounts.
 *
 * This component is a composition layer that uses:
 * - ImageSelector for image selection
 * - EnvVarEditor for environment variable editing
 * - FileVarEditor for file mount editing
 *
 * @example
 * ```tsx
 * const { containers, ...handlers } = useContainerForm({ initialContainers });
 * const { secretReferences } = useSecretReferences();
 *
 * <ContainerContent
 *   containers={containers}
 *   {...handlers}
 *   builds={builds}
 *   secretReferences={secretReferences}
 *   disabled={false}
 *   singleContainerMode
 * />
 * ```
 */
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
  builds = [],
  secretReferences = [],
}: ContainerContentProps) {
  const classes = useStyles();

  // Use mode state hooks for tracking plain/secret modes
  const envModes = useModeState({ type: 'env', initialContainers: containers });
  const fileModes = useModeState({
    type: 'file',
    initialContainers: containers,
  });

  const containerEntries = Object.entries(containers);
  const showAddButton = !singleContainerMode || containerEntries.length === 0;

  // Convert secret references to SecretOption format
  const secretOptions: SecretOption[] = secretReferences.map(ref => ({
    name: ref.name,
    displayName: ref.displayName,
    keys: ref.data?.map(item => item.secretKey) || [],
  }));

  const handleRemoveContainer = (containerName: string) => {
    envModes.cleanupContainer(containerName);
    fileModes.cleanupContainer(containerName);
    onRemoveContainer(containerName);
  };

  const handleEnvVarModeChange = (
    containerName: string,
    index: number,
    mode: 'plain' | 'secret',
  ) => {
    envModes.setMode(containerName, index, mode);

    // Clear conflicting values when switching modes
    if (mode === 'plain') {
      onEnvVarChange(containerName, index, 'value', '');
      onEnvVarChange(containerName, index, 'valueFrom', undefined as any);
    } else {
      onEnvVarChange(containerName, index, 'value', undefined as any);
      onEnvVarChange(containerName, index, 'valueFrom', {
        secretRef: { name: '', key: '' },
      } as any);
    }
  };

  const handleFileVarModeChange = (
    containerName: string,
    index: number,
    mode: 'plain' | 'secret',
  ) => {
    fileModes.setMode(containerName, index, mode);

    // Clear conflicting values when switching modes
    if (mode === 'plain') {
      onFileVarChange(containerName, index, 'value', '');
      onFileVarChange(containerName, index, 'valueFrom', undefined as any);
    } else {
      onFileVarChange(containerName, index, 'value', undefined as any);
      onFileVarChange(containerName, index, 'valueFrom', {
        secretRef: { name: '', key: '' },
      } as any);
    }
  };

  const handleRemoveEnvVar = (containerName: string, index: number) => {
    envModes.cleanupIndex(containerName, index);
    onRemoveEnvVar(containerName, index);
  };

  const handleRemoveFileVar = (containerName: string, index: number) => {
    fileModes.cleanupIndex(containerName, index);
    onRemoveFileVar(containerName, index);
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
                  onClick={() => handleRemoveContainer(containerName)}
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
                <EnvVarEditor
                  key={index}
                  envVar={envVar}
                  secrets={secretOptions}
                  disabled={disabled}
                  mode={envModes.getMode(containerName, index)}
                  onChange={(field, value) =>
                    onEnvVarChange(containerName, index, field, value)
                  }
                  onRemove={() => handleRemoveEnvVar(containerName, index)}
                  onModeChange={mode =>
                    handleEnvVarModeChange(containerName, index, mode)
                  }
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

            {/* File Mounts */}
            <Box mt={3}>
              <Typography
                variant="subtitle2"
                gutterBottom
                style={{ fontWeight: 600 }}
              >
                File Mounts
              </Typography>
              {(container as any).files?.map(
                (fileVar: FileVar, index: number) => (
                  <FileVarEditor
                    key={index}
                    fileVar={fileVar}
                    id={`${containerName}-${index}`}
                    secrets={secretOptions}
                    disabled={disabled}
                    mode={fileModes.getMode(containerName, index)}
                    onChange={(field, value) =>
                      onFileVarChange(containerName, index, field, value)
                    }
                    onRemove={() => handleRemoveFileVar(containerName, index)}
                    onModeChange={mode =>
                      handleFileVarModeChange(containerName, index, mode)
                    }
                  />
                ),
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
