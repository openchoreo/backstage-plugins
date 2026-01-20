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
} from '@material-ui/core';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { RJSFValidationError } from '@rjsf/utils';
import { JSONSchema7 } from 'json-schema';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
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
import { useStyles } from './styles';

interface WorkflowConfigPageProps {
  workflowName: string;
  systemParameters: { [key: string]: unknown } | null;
  parameters?: { [key: string]: unknown } | null;
  onBack: () => void;
  onSaved: () => void;
}

export const WorkflowConfigPage = ({
  workflowName,
  systemParameters,
  parameters,
  onBack,
  onSaved,
}: WorkflowConfigPageProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoCiClientApiRef);

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

  const loadWorkflowSchema = useCallback(async () => {
    if (!workflowName) {
      setError('No workflow name provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const namespace =
        entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

      if (!namespace) {
        throw new Error('Namespace not found in entity');
      }

      const schemaResponse = await client.fetchWorkflowSchema(
        namespace,
        workflowName,
      );

      if (schemaResponse.success && schemaResponse.data) {
        const rawSchema = schemaResponse.data as JSONSchema7;

        // Remove commit property from systemParameters.repository.revision if it exists
        const revisionProperties = (
          rawSchema.properties?.systemParameters as JSONSchema7
        )?.properties?.repository as JSONSchema7 | undefined;

        if (
          revisionProperties?.properties?.revision &&
          typeof revisionProperties.properties.revision === 'object'
        ) {
          const revision = revisionProperties.properties
            .revision as JSONSchema7;
          if (revision.properties?.commit) {
            delete revision.properties.commit;

            // Also remove 'commit' from the required array if it exists
            if (revision.required && Array.isArray(revision.required)) {
              revision.required = revision.required.filter(
                field => field !== 'commit',
              );
            }
          }
        }

        // Filter out empty object properties before setting schema
        const filteredSchema = filterEmptyObjectProperties(rawSchema);
        setSchema(addTitlesToSchema(filteredSchema));
      } else {
        throw new Error('Failed to fetch workflow schema');
      }

      if (systemParameters) {
        setFormData({
          systemParameters,
          parameters: parameters ? parameters : undefined,
        });
        setInitialFormData({ systemParameters, parameters });
      } else {
        setFormData({});
        setInitialFormData({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entity, client, workflowName, systemParameters, parameters]);

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
      await client.updateComponentWorkflowParameters(
        entity,
        formData.systemParameters,
        formData.parameters,
      );

      setShowSaveConfirm(false);
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
          formData={{ [activeTab]: formData[activeTab] }}
          onChange={handleFormChange}
          validator={validator}
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
