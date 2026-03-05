import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  WarningPanel,
} from '@backstage/core-components';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { useGitSecrets } from './hooks/useGitSecrets';
import { SecretsTable } from './SecretsTable';
import { CreateSecretDialog } from './CreateSecretDialog';
import { useAsync } from 'react-use';

const useStyles = makeStyles(theme => ({
  content: {
    padding: theme.spacing(3),
  },
  namespaceSelector: {
    minWidth: 300,
    marginBottom: theme.spacing(3),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
}));

/**
 * Git Secrets content without Page/Header/Content wrapper.
 * Used inside the unified SettingsPage.
 */
export const GitSecretsContent = () => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch available namespaces
  const {
    value: namespaces,
    loading: namespacesLoading,
    error: namespacesError,
  } = useAsync(async () => {
    return client.listNamespaces();
  }, [client]);

  // Use the git secrets hook for the selected namespace
  const {
    secrets,
    loading: secretsLoading,
    error: secretsError,
    createSecret,
    deleteSecret,
  } = useGitSecrets(selectedNamespace);

  const handleNamespaceChange = (
    event: React.ChangeEvent<{ value: unknown }>,
  ) => {
    setSelectedNamespace(event.target.value as string);
  };

  const handleCreateSecret = async (
    secretName: string,
    secretType: 'basic-auth' | 'ssh-auth',
    tokenOrKey: string,
    username?: string,
    sshKeyId?: string,
  ) => {
    await createSecret(secretName, secretType, tokenOrKey, username, sshKeyId);
  };

  const handleDeleteSecret = async (secretName: string) => {
    await deleteSecret(secretName);
  };

  // Sort namespaces alphabetically
  const sortedNamespaces = useMemo(() => {
    if (!namespaces) return [];
    return [...namespaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [namespaces]);

  return (
    <>
      {/* Namespace Selector */}
      <FormControl variant="outlined" className={classes.namespaceSelector}>
        <InputLabel id="namespace-select-label">Namespace</InputLabel>
        <Select
          labelId="namespace-select-label"
          label="Namespace"
          value={selectedNamespace}
          onChange={handleNamespaceChange}
          disabled={namespacesLoading}
        >
          {namespacesLoading && (
            <MenuItem disabled>
              <CircularProgress size={20} style={{ marginRight: 8 }} />
              Loading namespaces...
            </MenuItem>
          )}
          {!namespacesLoading && sortedNamespaces.length === 0 && (
            <MenuItem disabled>No namespaces available</MenuItem>
          )}
          {!namespacesLoading &&
            sortedNamespaces.map(ns => (
              <MenuItem key={ns.name} value={ns.name}>
                {ns.displayName || ns.name}
              </MenuItem>
            ))}
        </Select>
      </FormControl>

      {/* Error Display */}
      {namespacesError && (
        <WarningPanel severity="error" title="Failed to load namespaces">
          <Typography>
            {namespacesError.message ||
              'An error occurred while loading namespaces.'}
          </Typography>
        </WarningPanel>
      )}

      {secretsError && (
        <WarningPanel severity="error" title="Failed to load git secrets">
          <Typography>
            {secretsError.message ||
              'An error occurred while loading git secrets.'}
          </Typography>
        </WarningPanel>
      )}

      {/* Content */}
      {!selectedNamespace ? (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="textSecondary">
            Select a namespace to manage git secrets
          </Typography>
        </Box>
      ) : (
        <SecretsTable
          secrets={secrets}
          loading={secretsLoading}
          onDelete={handleDeleteSecret}
          onCreateClick={() => setCreateDialogOpen(true)}
          namespaceName={selectedNamespace}
        />
      )}

      {/* Create Secret Dialog */}
      <CreateSecretDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateSecret}
        namespaceName={selectedNamespace}
        existingSecretNames={secrets.map(s => s.name)}
      />
    </>
  );
};

/**
 * Standalone Git Secrets page (backwards compatibility).
 */
export const GitSecretsPage = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Header
        title="Git Secrets"
        subtitle="Manage git credentials for accessing private repositories"
      />
      <Content className={classes.content}>
        <GitSecretsContent />
      </Content>
    </Page>
  );
};
