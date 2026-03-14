import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Button,
  Box,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { RJSFValidationError, WidgetProps } from '@rjsf/utils';
import { JSONSchema7 } from 'json-schema';
import {
  useApi,
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useEntity, catalogApiRef } from '@backstage/plugin-catalog-react';
import { openChoreoCiClientApiRef } from '../../api/OpenChoreoCiClientApi';
import {
  CHOREO_ANNOTATIONS,
  sanitizeLabel,
  filterEmptyObjectProperties,
} from '@openchoreo/backstage-plugin-common';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import {
  UnsavedChangesDialog,
  useChangeDetection,
  DetailPageLayout,
} from '@openchoreo/backstage-plugin-react';
import { ChangesPreview } from './EditWorkflowConfigs/ChangesPreview';
import { addTitlesToSchema } from './EditWorkflowConfigs/utils';
import { walkSchemaForGitFields } from '../../utils/schemaExtensions';
import { useStyles } from './styles';

/**
 * Custom RJSF widget that renders a git secret dropdown instead of a plain
 * text input.  Receives available secrets via formContext.
 */
const SecretRefWidget = (props: WidgetProps) => {
  const { value, onChange, label, formContext } = props;
  const secrets: string[] = formContext?.gitSecrets ?? [];
  const loading: boolean = formContext?.secretsLoading ?? false;

  return (
    <Autocomplete
      options={secrets}
      value={value || ''}
      onChange={(_e: any, newValue: string | null) => onChange(newValue || '')}
      freeSolo
      loading={loading}
      renderInput={params => (
        <TextField
          {...params}
          label={label || 'Secret Reference'}
          variant="outlined"
          helperText="Secret reference for private repository credentials (optional for public repos)"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      noOptionsText="No git secrets available"
    />
  );
};

interface WorkflowConfigPageProps {
  workflowName: string;
  workflowKind?: 'Workflow' | 'ClusterWorkflow';
  parameters?: { [key: string]: unknown } | null;
  onBack: () => void;
  onSaved: () => void;
}

export const WorkflowConfigPage = ({
  workflowName,
  workflowKind,
  parameters,
  onBack,
  onSaved,
}: WorkflowConfigPageProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoCiClientApiRef);
  const alertApi = useApi(alertApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [initialFormData, setInitialFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<RJSFValidationError[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [gitSecrets, setGitSecrets] = useState<string[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(false);
  const catalogApi = useApi(catalogApiRef);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';

  // Fetch available git secrets for the component's namespace, filtered by
  // the workflow's workflowPlaneRef so only relevant secrets are shown.
  const fetchGitSecrets = useCallback(async () => {
    if (!namespace) {
      setGitSecrets([]);
      return;
    }
    setSecretsLoading(true);
    setGitSecrets([]);
    try {
      // 1. Fetch the workflow entity to get its plane annotations
      let planeRef: string | undefined;
      let planeRefKind: string | undefined;

      if (workflowName) {
        const filter: Record<string, string> = {
          'metadata.name': workflowName,
        };
        if (workflowKind === 'ClusterWorkflow') {
          filter.kind = 'ClusterWorkflow';
          filter['metadata.namespace'] = 'openchoreo-cluster';
        } else {
          filter.kind = 'Workflow';
          filter['metadata.namespace'] = namespace;
        }

        const catalogResponse = await catalogApi.getEntities({ filter });
        const workflowEntity = catalogResponse.items[0];
        planeRef =
          workflowEntity?.metadata?.annotations?.[
            CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF
          ];
        planeRefKind =
          workflowEntity?.metadata?.annotations?.[
            CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF_KIND
          ];
      }

      // 2. Fetch all secrets for the namespace
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
      const response = await fetchApi.fetch(
        `${baseUrl}/git-secrets?namespaceName=${encodeURIComponent(namespace)}`,
      );
      if (response.ok) {
        const result = await response.json();
        const allSecrets: Array<{
          name: string;
          workflowPlaneName?: string;
          workflowPlaneKind?: string;
        }> = result.items || [];

        // 3. Filter by workflow plane if the workflow has a plane ref
        const filtered =
          planeRef && planeRefKind
            ? allSecrets.filter(
                s =>
                  s.workflowPlaneName === planeRef &&
                  s.workflowPlaneKind === planeRefKind,
              )
            : allSecrets;

        setGitSecrets(filtered.map(s => s.name));
      } else {
        setGitSecrets([]);
      }
    } catch {
      setGitSecrets([]);
    } finally {
      setSecretsLoading(false);
    }
  }, [
    namespace,
    workflowName,
    workflowKind,
    discoveryApi,
    fetchApi,
    catalogApi,
  ]);

  useEffect(() => {
    fetchGitSecrets();
  }, [fetchGitSecrets]);

  const loadWorkflowSchema = useCallback(async () => {
    if (!workflowName) {
      setError('No workflow name provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!namespace) {
        throw new Error('Namespace not found in entity');
      }

      const schemaResponse = await client.fetchWorkflowSchema(
        namespace,
        workflowName,
        workflowKind,
      );

      // The backend returns the raw JSON Schema directly (or a {success, data} wrapper for legacy responses)
      const rawSchema = (
        schemaResponse.success !== undefined && schemaResponse.data
          ? schemaResponse.data
          : schemaResponse
      ) as JSONSchema7;

      if (!rawSchema || typeof rawSchema !== 'object') {
        throw new Error('Failed to fetch workflow schema');
      }

      // Filter out empty object properties before setting schema
      const filteredSchema = filterEmptyObjectProperties(rawSchema);
      setSchema(addTitlesToSchema(filteredSchema));

      if (parameters) {
        setFormData(parameters);
        setInitialFormData(parameters);
      } else {
        setFormData({});
        setInitialFormData({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [namespace, client, workflowName, workflowKind, parameters]);

  useEffect(() => {
    if (workflowName) {
      loadWorkflowSchema();
    }
  }, [workflowName, loadWorkflowSchema]);

  // Build tabs from schema properties
  const tabs = useMemo<TabItemData[]>(() => {
    if (!schema?.properties) return [];

    return Object.entries(schema.properties)
      .filter(([_, value]) => typeof value === 'object')
      .map(([key, value]) => {
        const propSchema = value as JSONSchema7;

        return {
          id: key,
          label: propSchema.title || sanitizeLabel(key),
        };
      });
  }, [schema]);

  // Set default active tab when tabs are loaded
  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Create sub-schema for active tab
  const activePropertySchema = useMemo<JSONSchema7 | null>(() => {
    if (!schema?.properties || !activeTab) return null;

    const propSchema = schema.properties[activeTab];
    if (!propSchema || typeof propSchema !== 'object') return null;

    return {
      type: 'object',
      properties: {
        [activeTab]: propSchema as JSONSchema7,
      },
    };
  }, [schema, activeTab]);

  // Detect secretRef fields via vendor extensions and build a uiSchema that
  // maps them to the custom SecretRefWidget dropdown.
  const secretRefUiSchema = useMemo(() => {
    if (!schema?.properties) return {};
    const mapping = walkSchemaForGitFields(
      schema.properties as Record<string, any>,
      '',
    );
    const secretRefPath = mapping.secretRef;
    if (!secretRefPath) return {};

    // Convert dot-delimited path to nested uiSchema object.
    // e.g. "repository.secretRef" → { repository: { secretRef: { 'ui:widget': ... } } }
    let ui: any = { 'ui:widget': 'secretRefWidget' };
    const parts = secretRefPath.split('.');
    for (let i = parts.length - 1; i >= 0; i--) {
      ui = { [parts[i]]: ui };
    }
    return ui;
  }, [schema]);

  const customWidgets = useMemo(
    () => ({ secretRefWidget: SecretRefWidget }),
    [],
  );

  // Use shared change detection hook
  const { changes, hasChanges, changeCount } = useChangeDetection(
    initialFormData,
    formData,
  );

  const handleSaveClick = () => {
    if (schema) {
      const validationResult = validator.validateFormData(formData, schema);
      if (validationResult.errors && validationResult.errors.length > 0) {
        setFormErrors(validationResult.errors);
        setError(validationResult.errors.map(e => e.message).join(', '));
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    if (!hasChanges) {
      setError('No changes to save');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setShowSaveConfirm(true);
  };

  // Handle back button click - show warning if there are unsaved changes
  const handleBackClick = () => {
    if (hasChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      onBack();
    }
  };

  const handleCancelSave = () => {
    setShowSaveConfirm(false);
    setError(null);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await client.updateComponentWorkflowParameters(entity, formData);

      setShowSaveConfirm(false);
      alertApi.post({
        message: 'Workflow configuration successfully updated',
        severity: 'success',
      });
      onSaved();
      onBack();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update workflow parameters',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (e: any) => {
    // Merge the changed property into the main formData
    setFormData((prev: any) => ({
      ...prev,
      [activeTab]: e.formData[activeTab],
    }));
    setFormErrors(e.errors || []);
  };

  const hasValidationErrors = formErrors.length > 0;

  const headerActions = (
    <Button
      variant="contained"
      color="primary"
      onClick={handleSaveClick}
      disabled={saving || loading || hasValidationErrors || !hasChanges}
    >
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  );

  // Render tab content with individual form
  const renderTabContent = () => {
    if (!activePropertySchema || !activeTab || !schema?.properties) return null;

    return (
      <Box>
        {error && (
          <Box className={classes.errorBanner}>
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          </Box>
        )}

        <Form
          schema={activePropertySchema}
          uiSchema={secretRefUiSchema}
          formData={{ [activeTab]: formData[activeTab] }}
          onChange={handleFormChange}
          validator={validator}
          widgets={customWidgets}
          formContext={{ gitSecrets, secretsLoading }}
          liveValidate
          showErrorList={false}
          noHtml5Validate
        >
          <div />
        </Form>
      </Box>
    );
  };

  return (
    <>
      <DetailPageLayout
        title="Configure Workflow"
        subtitle={workflowName}
        onBack={handleBackClick}
        actions={headerActions}
      >
        {loading && (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
            <Typography variant="body2" color="textSecondary">
              Loading workflow schema...
            </Typography>
          </Box>
        )}

        {error && !schema && !loading && (
          <Box className={classes.errorContainer}>
            <Typography color="error">{error}</Typography>
            <Button onClick={loadWorkflowSchema} variant="outlined">
              Retry
            </Button>
          </Box>
        )}

        {!loading && !error && schema && tabs.length === 0 && (
          <Box className={classes.errorContainer}>
            <Typography color="textSecondary">
              No configuration options available for this workflow
            </Typography>
          </Box>
        )}

        {!loading && schema && tabs.length > 0 && (
          <VerticalTabNav
            tabs={tabs}
            activeTabId={activeTab}
            onChange={setActiveTab}
            className={classes.tabNav}
          >
            {renderTabContent()}
          </VerticalTabNav>
        )}
      </DetailPageLayout>

      <Dialog
        open={showSaveConfirm}
        onClose={handleCancelSave}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Changes</DialogTitle>
        <DialogContent>
          <ChangesPreview changes={changes} />
          {error && (
            <Box mt={2} p={2} bgcolor="error.light" borderRadius={1}>
              <Typography color="error" variant="body2">
                <strong>Error:</strong> {error}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSave} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSave}
            color="primary"
            variant="contained"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedChangesDialog}
        onDiscard={() => {
          setShowUnsavedChangesDialog(false);
          onBack();
        }}
        onStay={() => setShowUnsavedChangesDialog(false)}
        changeCount={changeCount}
      />
    </>
  );
};
