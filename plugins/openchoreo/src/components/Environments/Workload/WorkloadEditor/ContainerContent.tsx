import {
  TextField,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Box,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  Container,
  EnvVar,
  FileVar,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';
import {
  useModeState,
  useEnvVarEditBuffer,
  useFileVarEditBuffer,
  StandardEnvVarList,
  OverrideEnvVarList,
  StandardFileVarList,
  OverrideFileVarList,
  getBaseEnvVarsForContainer,
  getBaseFileVarsForContainer,
  type SecretReference,
} from '@openchoreo/backstage-plugin-react';
import type { SecretOption } from '@openchoreo/backstage-design-system';

// Internal key used when adapting the single container to hooks that expect a map.
const CONTAINER_KEY = 'main';

export interface ContainerContentProps {
  /** Single container configuration */
  container: Container | undefined;
  /** Callback when a container field changes */
  onContainerChange: (field: keyof Container, value: string | string[]) => void;
  /** Callback when an environment variable field changes */
  onEnvVarChange: (
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => void;
  /** Callback when a file mount field changes */
  onFileVarChange: (
    fileIndex: number,
    field: keyof FileVar,
    value: string,
  ) => void;
  /** Callback when a new environment variable should be added */
  onAddEnvVar: () => void;
  /** Callback when an environment variable should be removed */
  onRemoveEnvVar: (envIndex: number) => void;
  /** Callback when a new file mount should be added */
  onAddFileVar: () => void;
  /** Callback when a file mount should be removed */
  onRemoveFileVar: (fileIndex: number) => void;
  /** Callback when an array field (command, args) changes */
  onArrayFieldChange: (field: 'command' | 'args', value: string) => void;
  /** Whether the editor is disabled */
  disabled: boolean;
  /** Whether to hide container fields (image, command, args) */
  hideContainerFields?: boolean;
  /** Available secret references (optional) */
  secretReferences?: SecretReference[];
  /** Base workload data for reference display (optional) */
  baseWorkloadData?: ModelsWorkload | null;
  /** Whether to show env var status badges and enable inline override (optional) */
  showEnvVarStatus?: boolean;
  /** Callback when user starts overriding an inherited env var (optional) */
  onStartOverride?: (envVar: EnvVar) => void;
  /** Callback when user starts overriding an inherited file var (optional) */
  onStartFileOverride?: (fileVar: FileVar) => void;
  /** Callback to replace an entire env var at once (avoids race conditions) */
  onEnvVarReplace?: (envIndex: number, envVar: EnvVar) => void;
  /** Callback to replace an entire file var at once (avoids race conditions) */
  onFileVarReplace?: (fileIndex: number, fileVar: FileVar) => void;
  /** Environment name for display in override section titles */
  environmentName?: string;
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
}));

/**
 * Component for editing a single container configuration including image, command, args,
 * environment variables, and file mounts.
 *
 * Uses StandardEnvVarList/StandardFileVarList for workload editing and
 * OverrideEnvVarList/OverrideFileVarList for environment-specific overrides.
 */
export function ContainerContent({
  container,
  onContainerChange,
  onEnvVarChange,
  onAddEnvVar,
  onRemoveEnvVar,
  onArrayFieldChange,
  onFileVarChange,
  onAddFileVar,
  onRemoveFileVar,
  disabled,
  hideContainerFields = false,
  secretReferences = [],
  baseWorkloadData,
  showEnvVarStatus = false,
  onStartOverride,
  onStartFileOverride,
  onEnvVarReplace,
  onFileVarReplace,
  environmentName,
}: ContainerContentProps) {
  const classes = useStyles();

  // Wrap the single container in a map for hooks that expect the map format.
  const containerMap: Record<string, Container> = container
    ? { [CONTAINER_KEY]: container }
    : {};

  // Use mode state hooks for tracking plain/secret modes
  const envModes = useModeState({
    type: 'env',
    initialContainers: containerMap,
  });
  const fileModes = useModeState({
    type: 'file',
    initialContainers: containerMap,
  });

  // Adapters: hooks call callbacks with (containerName, ...) — we drop the containerName.
  const internalOnEnvVarChange = (
    _cn: string,
    i: number,
    f: keyof EnvVar,
    v: string,
  ) => onEnvVarChange(i, f, v);
  const internalOnEnvVarReplace = (_cn: string, i: number, ev: EnvVar) =>
    onEnvVarReplace?.(i, ev);
  const internalOnRemoveEnvVar = (_cn: string, i: number) => {
    envModes.cleanupIndex(_cn, i);
    onRemoveEnvVar(i);
  };
  const internalOnFileVarChange = (
    _cn: string,
    i: number,
    f: keyof FileVar,
    v: string,
  ) => onFileVarChange(i, f, v);
  const internalOnFileVarReplace = (_cn: string, i: number, fv: FileVar) =>
    onFileVarReplace?.(i, fv);
  const internalOnRemoveFileVar = (_cn: string, i: number) => {
    fileModes.cleanupIndex(_cn, i);
    onRemoveFileVar(i);
  };

  // Use edit buffer hooks for managing single-row editing
  const envEditBuffer = useEnvVarEditBuffer({
    containers: containerMap,
    onEnvVarReplace: internalOnEnvVarReplace,
    onEnvVarChange: internalOnEnvVarChange,
    onRemoveEnvVar: internalOnRemoveEnvVar,
  });

  const fileEditBuffer = useFileVarEditBuffer({
    containers: containerMap,
    onFileVarReplace: internalOnFileVarReplace,
    onFileVarChange: internalOnFileVarChange,
    onRemoveFileVar: internalOnRemoveFileVar,
  });

  // Convert secret references to SecretOption format
  const secretOptions: SecretOption[] = secretReferences.map(ref => ({
    name: ref.name,
    displayName: ref.displayName,
    keys: ref.data?.map(item => item.secretKey) || [],
  }));

  const handleEnvVarModeChange = (
    containerName: string,
    index: number,
    mode: 'plain' | 'secret',
  ) => {
    envModes.setMode(containerName, index, mode);

    if (!envEditBuffer.isRowEditing(containerName, index)) {
      if (mode === 'plain') {
        onEnvVarChange(index, 'value', '');
        onEnvVarChange(index, 'valueFrom', undefined as any);
      } else {
        onEnvVarChange(index, 'value', undefined as any);
        onEnvVarChange(index, 'valueFrom', {
          secretRef: { name: '', key: '' },
        } as any);
      }
    }
  };

  const handleFileVarModeChange = (
    containerName: string,
    index: number,
    mode: 'plain' | 'secret',
  ) => {
    fileModes.setMode(containerName, index, mode);

    if (!fileEditBuffer.isRowEditing(containerName, index)) {
      if (mode === 'plain') {
        onFileVarChange(index, 'value', '');
        onFileVarChange(index, 'valueFrom', undefined as any);
      } else {
        onFileVarChange(index, 'value', undefined as any);
        onFileVarChange(index, 'valueFrom', {
          secretRef: { name: '', key: '' },
        } as any);
      }
    }
  };

  if (!container) return null;

  return (
    <Box>
      <Card className={classes.containerCard}>
        <CardHeader
          style={{ paddingBottom: 8 }}
          title={<Typography variant="h4">Container</Typography>}
        />
        <CardContent style={{ paddingTop: 8 }}>
          <Grid container spacing={2}>
            {!hideContainerFields && (
              <>
                <Grid item xs={12}>
                  <Box mb={2}>
                    <TextField
                      label="Image"
                      value={container.image || ''}
                      onChange={e => onContainerChange('image', e.target.value)}
                      fullWidth
                      variant="outlined"
                      disabled={disabled}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Command"
                    value={container.command?.join(', ') || ''}
                    onChange={e =>
                      onArrayFieldChange('command', e.target.value)
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
                    onChange={e => onArrayFieldChange('args', e.target.value)}
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
            <Typography variant="h5" gutterBottom>
              Environment Variables
            </Typography>
            {showEnvVarStatus && baseWorkloadData ? (
              <OverrideEnvVarList
                containerName={CONTAINER_KEY}
                envVars={container.env || []}
                baseEnvVars={getBaseEnvVarsForContainer(baseWorkloadData)}
                environmentName={environmentName}
                secretOptions={secretOptions}
                envModes={envModes}
                disabled={disabled}
                editBuffer={envEditBuffer}
                onStartOverride={(_cn, ev) => onStartOverride?.(ev)}
                onEnvVarChange={internalOnEnvVarChange}
                onRemoveEnvVar={internalOnRemoveEnvVar}
                onEnvVarModeChange={handleEnvVarModeChange}
                onAddEnvVar={() => onAddEnvVar()}
              />
            ) : (
              <StandardEnvVarList
                containerName={CONTAINER_KEY}
                envVars={container.env || []}
                secretOptions={secretOptions}
                envModes={envModes}
                disabled={disabled}
                editBuffer={envEditBuffer}
                onEnvVarChange={internalOnEnvVarChange}
                onRemoveEnvVar={internalOnRemoveEnvVar}
                onEnvVarModeChange={handleEnvVarModeChange}
                onAddEnvVar={() => onAddEnvVar()}
              />
            )}
          </Box>

          {/* File Mounts */}
          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              File Mounts
            </Typography>
            {showEnvVarStatus && baseWorkloadData ? (
              <OverrideFileVarList
                containerName={CONTAINER_KEY}
                fileVars={(container as any).files || []}
                baseFileVars={getBaseFileVarsForContainer(baseWorkloadData)}
                environmentName={environmentName}
                secretOptions={secretOptions}
                fileModes={fileModes}
                disabled={disabled}
                editBuffer={fileEditBuffer}
                onStartOverride={(_cn, fv) => onStartFileOverride?.(fv)}
                onFileVarChange={internalOnFileVarChange}
                onRemoveFileVar={internalOnRemoveFileVar}
                onFileVarModeChange={handleFileVarModeChange}
                onAddFileVar={() => onAddFileVar()}
              />
            ) : (
              <StandardFileVarList
                containerName={CONTAINER_KEY}
                fileVars={(container as any).files || []}
                secretOptions={secretOptions}
                fileModes={fileModes}
                disabled={disabled}
                editBuffer={fileEditBuffer}
                onFileVarChange={internalOnFileVarChange}
                onRemoveFileVar={internalOnRemoveFileVar}
                onFileVarModeChange={handleFileVarModeChange}
                onAddFileVar={() => onAddFileVar()}
              />
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
