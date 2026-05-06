import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Button,
  IconButton,
} from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  WarningPanel,
} from '@backstage/core-components';
import { ForbiddenState } from '@openchoreo/backstage-plugin-react';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import AddIcon from '@material-ui/icons/Add';
import RefreshIcon from '@material-ui/icons/Refresh';
import {
  openChoreoClientApiRef,
  TargetPlaneKind,
} from '../../api/OpenChoreoClientApi';
import { useSecrets } from './hooks/useSecrets';
import { SecretsTable } from './SecretsTable';
import {
  CreateSecretDialog,
  type TargetPlaneOption,
} from './CreateSecretDialog';
import { useAsync } from 'react-use';

const useStyles = makeStyles(theme => ({
  content: {
    padding: theme.spacing(3),
  },
  root: {
    width: '100%',
    maxWidth: 1200,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingTop: theme.spacing(3),
  },
  namespaceSelector: {
    minWidth: 300,
  },
}));

/**
 * Secrets content without Page/Header/Content wrapper.
 */
export const SecretsContent = () => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const catalogApi = useApi(catalogApiRef);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const {
    value: namespaces,
    loading: namespacesLoading,
    error: namespacesError,
  } = useAsync(async () => {
    return client.listNamespaces();
  }, [client]);

  // Fetch all four plane kinds for the target-plane dropdown
  const { value: targetPlanes, loading: targetPlanesLoading } =
    useAsync(async (): Promise<TargetPlaneOption[]> => {
      if (!selectedNamespace) return [];

      const [wpResult, cwpResult, dpResult, cdpResult] = await Promise.all([
        catalogApi.getEntities({
          filter: {
            kind: 'WorkflowPlane',
            'metadata.namespace': selectedNamespace,
          },
        }),
        catalogApi.getEntities({
          filter: { kind: 'ClusterWorkflowPlane' },
        }),
        catalogApi.getEntities({
          filter: {
            kind: 'DataPlane',
            'metadata.namespace': selectedNamespace,
          },
        }),
        catalogApi.getEntities({
          filter: { kind: 'ClusterDataPlane' },
        }),
      ]);

      const planes: TargetPlaneOption[] = [];

      // Cluster-scoped first, then namespaced
      cdpResult.items.forEach(e => {
        planes.push({
          name: e.metadata.name,
          kind: 'ClusterDataPlane' as TargetPlaneKind,
        });
      });
      cwpResult.items.forEach(e => {
        planes.push({
          name: e.metadata.name,
          kind: 'ClusterWorkflowPlane' as TargetPlaneKind,
        });
      });
      dpResult.items.forEach(e => {
        planes.push({
          name: e.metadata.name,
          kind: 'DataPlane' as TargetPlaneKind,
        });
      });
      wpResult.items.forEach(e => {
        planes.push({
          name: e.metadata.name,
          kind: 'WorkflowPlane' as TargetPlaneKind,
        });
      });

      return planes;
    }, [catalogApi, selectedNamespace]);

  const {
    secrets,
    loading: secretsLoading,
    error: secretsError,
    isForbidden: secretsForbidden,
    createSecret,
    deleteSecret,
    fetchSecrets,
  } = useSecrets(selectedNamespace);

  const handleNamespaceChange = (
    event: React.ChangeEvent<{ value: unknown }>,
  ) => {
    setSelectedNamespace(event.target.value as string);
  };

  const handleDeleteSecret = async (secretName: string) => {
    await deleteSecret(secretName);
  };

  const sortedNamespaces = useMemo(() => {
    if (!namespaces) return [];
    return [...namespaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [namespaces]);

  useEffect(() => {
    if (!selectedNamespace && sortedNamespaces.length > 0) {
      setSelectedNamespace(sortedNamespaces[0].name);
    }
  }, [sortedNamespaces, selectedNamespace]);

  return (
    <Box className={classes.root}>
      <Box
        display="flex"
        alignItems="center"
        style={{ gap: 16, marginBottom: 16 }}
      >
        <FormControl
          variant="outlined"
          size="small"
          className={classes.namespaceSelector}
        >
          <InputLabel id="secrets-namespace-select-label">Namespace</InputLabel>
          <Select
            labelId="secrets-namespace-select-label"
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

        <Box flexGrow={1} />

        <IconButton
          onClick={fetchSecrets}
          size="small"
          title="Refresh"
          disabled={!selectedNamespace}
        >
          <RefreshIcon />
        </IconButton>
        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={!selectedNamespace}
        >
          Create Secret
        </Button>
      </Box>

      {namespacesError && (
        <WarningPanel severity="error" title="Failed to load namespaces">
          <Typography>
            {namespacesError.message ||
              'An error occurred while loading namespaces.'}
          </Typography>
        </WarningPanel>
      )}

      {secretsError &&
        (secretsForbidden ? (
          <ForbiddenState
            message="You do not have permission to view secrets."
            onRetry={fetchSecrets}
          />
        ) : (
          <WarningPanel severity="error" title="Failed to load secrets">
            <Typography>
              {secretsError.message ||
                'An error occurred while loading secrets.'}
            </Typography>
          </WarningPanel>
        ))}

      {!selectedNamespace ? (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="textSecondary">
            Select a namespace to manage secrets
          </Typography>
        </Box>
      ) : (
        !secretsForbidden && (
          <SecretsTable
            secrets={secrets}
            loading={secretsLoading}
            onDelete={handleDeleteSecret}
            namespaceName={selectedNamespace}
          />
        )
      )}

      <CreateSecretDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={createSecret}
        namespaceName={selectedNamespace}
        existingSecretNames={secrets.map(s => s.name)}
        targetPlanes={targetPlanes || []}
        targetPlanesLoading={targetPlanesLoading}
      />
    </Box>
  );
};

/**
 * Standalone Secrets page (sibling to GitSecretsPage).
 */
export const SecretsPage = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Header
        title="Secrets"
        subtitle="Manage credentials and configuration delivered to workloads"
      />
      <Content className={classes.content}>
        <SecretsContent />
      </Content>
    </Page>
  );
};
