import { useState, useEffect, useMemo, useCallback } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  Box,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  TextField,
  IconButton,
  CircularProgress,
  makeStyles,
  Button,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import Form from '@rjsf/material-ui';
import { JSONSchema7 } from 'json-schema';
import validator from '@rjsf/validator-ajv8';
import { generateUiSchemaWithTitles } from '../utils/rjsfUtils';
import { TraitPicker } from '../TraitsField/TraitPicker';
import { NoTraitsAvailableMessage } from '../TraitsField/NoTraitsAvailableMessage';
import type { TraitListItem } from '../TraitsField/TraitCard';
import type { AddedTrait } from '../TraitsField/TraitsFieldExtension';

import {
  EndpointList,
  useEndpointEditBuffer,
} from '@openchoreo/backstage-plugin-react';
import type { WorkloadEndpoint as CommonWorkloadEndpoint } from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
    fontWeight: 500,
  },
  divider: {
    margin: `${theme.spacing(3)}px 0`,
  },
  accordion: {
    marginTop: theme.spacing(2),
    '&:before': {
      display: 'none',
    },
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  accordionSummary: {
    backgroundColor: theme.palette.background.default,
  },
  chip: {
    marginLeft: theme.spacing(1),
  },
  accordionDetails: {
    display: 'block',
  },
  traitAccordion: {
    marginBottom: theme.spacing(1),
    '&:before': {
      display: 'none',
    },
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    '&.Mui-expanded': {
      margin: `0 0 ${theme.spacing(1)}px 0`,
    },
  },
  traitSummary: {
    minHeight: 48,
    '&.Mui-expanded': {
      minHeight: 48,
    },
  },
  traitSummaryContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginRight: theme.spacing(1),
  },
  traitTitle: {
    fontWeight: 500,
  },
  traitName: {
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
    fontSize: '0.875rem',
  },
  deleteButton: {
    padding: theme.spacing(0.5),
  },
  envRow: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    alignItems: 'center',
  },
  envField: {
    flex: 1,
  },
}));

/**
 * Data shape returned by WorkloadDetailsField
 */
export interface WorkloadDetailsData {
  ctdParameters: Record<string, any>;
  endpoints: Record<string, WorkloadEndpoint>;
  envVars: Array<{ key: string; value: string }>;
  fileMounts: Array<{ key: string; mountPath: string; value: string }>;
  traits: Array<{
    name: string;
    instanceName: string;
    config: Record<string, any>;
  }>;
}

/**
 * Schema for the WorkloadDetails Field
 */
export const WorkloadDetailsFieldSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};

type WorkloadEndpoint = CommonWorkloadEndpoint;

/**
 * WorkloadDetailsField component
 *
 * Composite field extension that consolidates:
 * - CTD parameters (mandatory + advanced accordion)
 * - Endpoints (for deployment/* types)
 * - Environment variables
 * - File mounts
 * - Traits
 */
export const WorkloadDetailsField = ({
  onChange,
  formData,
  uiSchema,
  formContext,
}: FieldExtensionComponentProps<WorkloadDetailsData>) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // Env vars and file mounts require a container with an image.
  // For build-from-source and external-ci the image isn't known yet,
  // so we hide these sections.
  const deploymentSource = (formContext as any)?.formData?.deploymentSource;
  const isFromImage = deploymentSource === 'deploy-from-image';

  // Extract options from uiSchema
  const namespaceName =
    typeof uiSchema?.['ui:options']?.namespaceName === 'string'
      ? uiSchema['ui:options'].namespaceName
      : '';
  const workloadType =
    typeof uiSchema?.['ui:options']?.workloadType === 'string'
      ? uiSchema['ui:options'].workloadType
      : '';
  const ctdSchema = uiSchema?.['ui:options']?.ctdSchema as
    | JSONSchema7
    | undefined;
  const isDeploymentType = workloadType.startsWith('deployment');

  // State
  const [ctdParameters, setCtdParameters] = useState<Record<string, any>>(
    formData?.ctdParameters || {},
  );
  const [endpoints, setEndpoints] = useState<Record<string, WorkloadEndpoint>>(
    formData?.endpoints || {},
  );
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    formData?.envVars || [],
  );
  const [fileMounts, setFileMounts] = useState<
    Array<{ key: string; mountPath: string; value: string }>
  >(formData?.fileMounts || []);

  // Traits state
  const [availableTraits, setAvailableTraits] = useState<TraitListItem[]>([]);
  const [addedTraits, setAddedTraits] = useState<AddedTrait[]>(() =>
    (formData?.traits || []).map((t, i) => ({
      id: `${t.name}-restored-${i}`,
      name: t.name,
      instanceName: t.instanceName,
      config: t.config,
    })),
  );
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [loadingTraitName, setLoadingTraitName] = useState<string | null>(null);
  const [traitError, setTraitError] = useState<string | null>(null);
  const [expandedTrait, setExpandedTrait] = useState<string | false>(false);

  // CTD advanced accordion
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // Propagate changes to parent
  const emitChange = useCallback(
    (
      newCtd: Record<string, any>,
      newEndpoints: Record<string, WorkloadEndpoint>,
      newEnvVars: Array<{ key: string; value: string }>,
      newFileMounts: Array<{ key: string; mountPath: string; value: string }>,
      newTraits: AddedTrait[],
    ) => {
      onChange({
        ctdParameters: newCtd,
        endpoints: newEndpoints,
        envVars: isFromImage ? newEnvVars : [],
        fileMounts: isFromImage ? newFileMounts : [],
        traits: newTraits.map(t => ({
          name: t.name,
          instanceName: t.instanceName,
          config: t.config,
        })),
      });
    },
    [onChange, isFromImage],
  );

  // ── CTD Parameters ──────────────────────────────────────────────

  const {
    essentialSchema,
    advancedSchema,
    essentialUiSchema,
    advancedUiSchema,
  } = useMemo(() => {
    if (
      !ctdSchema?.properties ||
      Object.keys(ctdSchema.properties).length === 0
    ) {
      return {
        essentialSchema: { type: 'object' as const, properties: {} },
        advancedSchema: { type: 'object' as const, properties: {} },
        essentialUiSchema: {},
        advancedUiSchema: {},
      };
    }

    const essential: JSONSchema7 = {
      type: 'object',
      properties: {},
      required: [],
    };
    const advanced: JSONSchema7 = {
      type: 'object',
      properties: {},
      required: [],
    };
    const advancedFieldNames = new Set([
      'containerName',
      'imagePullPolicy',
      'replicas',
    ]);

    const schemaRequired = ctdSchema.required || [];

    Object.entries(ctdSchema.properties).forEach(([key, propDef]) => {
      if (typeof propDef === 'boolean') return;
      const prop = propDef as JSONSchema7;

      const isRequired = schemaRequired.includes(key);
      const hasDefault = prop.default !== undefined;
      const isKnownAdvanced = advancedFieldNames.has(key);
      const isAdvanced = isKnownAdvanced || (hasDefault && !isRequired);

      if (isAdvanced) {
        advanced.properties![key] = prop;
        if (isRequired) {
          (advanced.required as string[]).push(key);
        }
      } else {
        essential.properties![key] = prop;
        if (isRequired) {
          (essential.required as string[]).push(key);
        }
      }
    });

    return {
      essentialSchema: essential,
      advancedSchema: advanced,
      essentialUiSchema: generateUiSchemaWithTitles(essential),
      advancedUiSchema: generateUiSchemaWithTitles(advanced),
    };
  }, [ctdSchema]);

  const essentialFieldCount = Object.keys(
    essentialSchema.properties || {},
  ).length;
  const advancedFieldCount = Object.keys(
    advancedSchema.properties || {},
  ).length;
  const hasCtdFields = essentialFieldCount > 0 || advancedFieldCount > 0;

  const essentialFormData = useMemo(() => {
    const data: Record<string, any> = {};
    Object.keys(essentialSchema.properties || {}).forEach(key => {
      if (ctdParameters?.[key] !== undefined) {
        data[key] = ctdParameters[key];
      }
    });
    return data;
  }, [ctdParameters, essentialSchema]);

  const advancedFormData = useMemo(() => {
    const data: Record<string, any> = {};
    Object.keys(advancedSchema.properties || {}).forEach(key => {
      if (ctdParameters?.[key] !== undefined) {
        data[key] = ctdParameters[key];
      }
    });
    return data;
  }, [ctdParameters, advancedSchema]);

  const handleCtdEssentialChange = useCallback(
    (changeEvent: any) => {
      const newCtd = { ...ctdParameters, ...changeEvent.formData };
      setCtdParameters(newCtd);
      emitChange(newCtd, endpoints, envVars, fileMounts, addedTraits);
    },
    [ctdParameters, endpoints, envVars, fileMounts, addedTraits, emitChange],
  );

  const handleCtdAdvancedChange = useCallback(
    (changeEvent: any) => {
      const newCtd = { ...ctdParameters, ...changeEvent.formData };
      setCtdParameters(newCtd);
      emitChange(newCtd, endpoints, envVars, fileMounts, addedTraits);
    },
    [ctdParameters, endpoints, envVars, fileMounts, addedTraits, emitChange],
  );

  // ── Endpoints ──────────────────────────────────────────────────

  const handleEndpointChange = useCallback(
    (newEndpoints: Record<string, WorkloadEndpoint>) => {
      setEndpoints(newEndpoints);
      emitChange(ctdParameters, newEndpoints, envVars, fileMounts, addedTraits);
    },
    [ctdParameters, envVars, fileMounts, addedTraits, emitChange],
  );

  const endpointEditBuffer = useEndpointEditBuffer({
    endpoints,
    onEndpointReplace: (name: string, endpoint: WorkloadEndpoint) => {
      const newEndpoints = { ...endpoints, [name]: endpoint };
      handleEndpointChange(newEndpoints);
    },
    onRemoveEndpoint: (name: string) => {
      const newEndpoints = { ...endpoints };
      delete newEndpoints[name];
      handleEndpointChange(newEndpoints);
    },
  });

  const handleRemoveEndpoint = useCallback(
    (name: string) => {
      const newEndpoints = { ...endpoints };
      delete newEndpoints[name];
      handleEndpointChange(newEndpoints);
    },
    [endpoints, handleEndpointChange],
  );

  const handleAddEndpoint = useCallback((): string => {
    const name = `endpoint-${Object.keys(endpoints).length + 1}`;
    const newEndpoint: WorkloadEndpoint = { type: 'HTTP', port: 8080 };
    const newEndpoints: Record<string, WorkloadEndpoint> = {
      ...endpoints,
      [name]: newEndpoint,
    };
    handleEndpointChange(newEndpoints);
    return name;
  }, [endpoints, handleEndpointChange]);

  // ── Environment Variables (simple inline editors) ──────────────

  const handleAddEnvVar = useCallback(() => {
    const newEnvVars = [...envVars, { key: '', value: '' }];
    setEnvVars(newEnvVars);
    emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
  }, [envVars, ctdParameters, endpoints, fileMounts, addedTraits, emitChange]);

  const handleEnvVarChange = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      const newEnvVars = envVars.map((ev, i) =>
        i === index ? { ...ev, [field]: value } : ev,
      );
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
    [envVars, ctdParameters, endpoints, fileMounts, addedTraits, emitChange],
  );

  const handleRemoveEnvVar = useCallback(
    (index: number) => {
      const newEnvVars = envVars.filter((_, i) => i !== index);
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
    [envVars, ctdParameters, endpoints, fileMounts, addedTraits, emitChange],
  );

  // ── File Mounts (simple inline editors) ────────────────────────

  const handleAddFileMount = useCallback(() => {
    const newFileMounts = [
      ...fileMounts,
      { key: '', mountPath: '', value: '' },
    ];
    setFileMounts(newFileMounts);
    emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
  }, [fileMounts, ctdParameters, endpoints, envVars, addedTraits, emitChange]);

  const handleFileMountChange = useCallback(
    (index: number, field: 'key' | 'mountPath' | 'value', value: string) => {
      const newFileMounts = fileMounts.map((fm, i) =>
        i === index ? { ...fm, [field]: value } : fm,
      );
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
    [fileMounts, ctdParameters, endpoints, envVars, addedTraits, emitChange],
  );

  const handleRemoveFileMount = useCallback(
    (index: number) => {
      const newFileMounts = fileMounts.filter((_, i) => i !== index);
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
    [fileMounts, ctdParameters, endpoints, envVars, addedTraits, emitChange],
  );

  // ── Traits ─────────────────────────────────────────────────────

  // Fetch available traits on mount
  useEffect(() => {
    let ignore = false;

    const fetchTraits = async () => {
      if (!namespaceName) return;

      setLoadingTraits(true);
      setTraitError(null);

      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const nsName = namespaceName.split('/').pop() || namespaceName;

        const response = await fetchApi.fetch(
          `${baseUrl}/traits?namespaceName=${encodeURIComponent(
            nsName,
          )}&page=1&pageSize=100`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!ignore && result.success) {
          setAvailableTraits(result.data.items);
        }
      } catch (err) {
        if (!ignore) {
          setTraitError(`Failed to fetch traits: ${err}`);
        }
      } finally {
        if (!ignore) {
          setLoadingTraits(false);
        }
      }
    };

    fetchTraits();

    return () => {
      ignore = true;
    };
  }, [namespaceName, discoveryApi, fetchApi]);

  const handleAddTrait = useCallback(
    async (traitName: string) => {
      if (!traitName || !namespaceName) return;

      setLoadingTraitName(traitName);
      setTraitError(null);

      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const nsName = namespaceName.split('/').pop() || namespaceName;

        const response = await fetchApi.fetch(
          `${baseUrl}/trait-schema?namespaceName=${encodeURIComponent(
            nsName,
          )}&traitName=${encodeURIComponent(traitName)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          const schema = result.data;
          const generatedUiSchema = generateUiSchemaWithTitles(schema);

          const existingCount = addedTraits.filter(
            t => t.name === traitName,
          ).length;

          const newTrait: AddedTrait = {
            id: `${traitName}-${Date.now()}`,
            name: traitName,
            instanceName: `${traitName}-${existingCount + 1}`,
            config: {},
            schema: schema,
            uiSchema: generatedUiSchema,
          };

          const updatedTraits = [...addedTraits, newTrait];
          setAddedTraits(updatedTraits);
          emitChange(
            ctdParameters,
            endpoints,
            envVars,
            fileMounts,
            updatedTraits,
          );
          setExpandedTrait(newTrait.id);
        }
      } catch (err) {
        setTraitError(`Failed to fetch trait schema: ${err}`);
      } finally {
        setLoadingTraitName(null);
      }
    },
    [
      namespaceName,
      addedTraits,
      ctdParameters,
      endpoints,
      envVars,
      fileMounts,
      discoveryApi,
      fetchApi,
      emitChange,
    ],
  );

  const handleRemoveTrait = useCallback(
    (id: string) => {
      const updatedTraits = addedTraits.filter(trait => trait.id !== id);
      setAddedTraits(updatedTraits);
      emitChange(ctdParameters, endpoints, envVars, fileMounts, updatedTraits);
    },
    [addedTraits, ctdParameters, endpoints, envVars, fileMounts, emitChange],
  );

  const handleTraitInstanceNameChange = useCallback(
    (id: string, instanceName: string) => {
      const updatedTraits = addedTraits.map(trait =>
        trait.id === id ? { ...trait, instanceName } : trait,
      );
      setAddedTraits(updatedTraits);
      emitChange(ctdParameters, endpoints, envVars, fileMounts, updatedTraits);
    },
    [addedTraits, ctdParameters, endpoints, envVars, fileMounts, emitChange],
  );

  const handleTraitConfigChange = useCallback(
    (id: string, config: Record<string, any>) => {
      const updatedTraits = addedTraits.map(trait =>
        trait.id === id ? { ...trait, config } : trait,
      );
      setAddedTraits(updatedTraits);
      emitChange(ctdParameters, endpoints, envVars, fileMounts, updatedTraits);
    },
    [addedTraits, ctdParameters, endpoints, envVars, fileMounts, emitChange],
  );

  const addedTraitNames = useMemo(
    () => addedTraits.map(t => t.name),
    [addedTraits],
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <Box>
      {/* ── CTD Parameters ── */}
      {hasCtdFields && (
        <>
          {/* Essential fields */}
          {essentialFieldCount > 0 && (
            <Form
              schema={essentialSchema}
              uiSchema={essentialUiSchema}
              formData={essentialFormData}
              onChange={handleCtdEssentialChange}
              validator={validator}
              liveValidate={false}
              showErrorList={false}
              noHtml5Validate
              tagName="div"
            >
              <div style={{ display: 'none' }} />
            </Form>
          )}
        </>
      )}

      {/* ── Endpoints (deployment types only) ── */}
      {isDeploymentType && (
        <>
          <Divider className={classes.divider} />
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Endpoints
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Define network endpoints for your component.
          </Typography>
          <EndpointList
            endpoints={endpoints}
            disabled={false}
            editBuffer={endpointEditBuffer}
            onRemoveEndpoint={handleRemoveEndpoint}
            onAddEndpoint={handleAddEndpoint}
          />
        </>
      )}

      {/* ── Container Configuration (env vars + file mounts grouped) ── */}
      <Divider className={classes.divider} />
      <Typography variant="subtitle1" className={classes.sectionTitle}>
        Container Configuration
      </Typography>

      {!isFromImage && (
        <Box mb={2}>
          <Alert severity="info">
            {deploymentSource === 'external-ci' ? (
              <>
                Environment variables and file mounts cannot be configured at
                creation time because the container image is not available yet.
                Once your external CI pipeline creates a workload with an image,
                you can configure these from the Deploy page. See the{' '}
                <a
                  href="https://openchoreo.github.io/docs/integrating-with-openchoreo/external-ci"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  External CI Integration Guide
                </a>{' '}
                for setup instructions.
              </>
            ) : (
              'Environment variables and file mounts cannot be configured at creation time because the container image is not available yet. Once a build completes, you can configure these from the Deploy page.'
            )}
          </Alert>
        </Box>
      )}

      {/* Environment Variables */}
      <Typography variant="subtitle2" className={classes.sectionTitle}>
        Environment Variables
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Define environment variables for your component.
      </Typography>
      {envVars.map((ev, index) => (
        <Box key={index} className={classes.envRow}>
          <TextField
            className={classes.envField}
            label="Key"
            value={ev.key}
            onChange={e => handleEnvVarChange(index, 'key', e.target.value)}
            variant="outlined"
            size="small"
            disabled={!isFromImage}
          />
          <TextField
            className={classes.envField}
            label="Value"
            value={ev.value}
            onChange={e => handleEnvVarChange(index, 'value', e.target.value)}
            variant="outlined"
            size="small"
            disabled={!isFromImage}
          />
          <IconButton
            size="small"
            onClick={() => handleRemoveEnvVar(index)}
            className={classes.deleteButton}
            disabled={!isFromImage}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={handleAddEnvVar}
        color="primary"
        disabled={!isFromImage}
      >
        Add Environment Variable
      </Button>

      {/* File Mounts */}
      <Box mt={3}>
        <Typography variant="subtitle2" className={classes.sectionTitle}>
          File Mounts
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Mount configuration files into your component.
        </Typography>
        {fileMounts.map((fm, index) => (
          <Box key={index} className={classes.envRow}>
            <TextField
              className={classes.envField}
              label="Filename"
              value={fm.key}
              onChange={e =>
                handleFileMountChange(index, 'key', e.target.value)
              }
              variant="outlined"
              size="small"
              disabled={!isFromImage}
            />
            <TextField
              className={classes.envField}
              label="Mount Path"
              value={fm.mountPath}
              onChange={e =>
                handleFileMountChange(index, 'mountPath', e.target.value)
              }
              variant="outlined"
              size="small"
              disabled={!isFromImage}
            />
            <TextField
              className={classes.envField}
              label="Content"
              value={fm.value}
              onChange={e =>
                handleFileMountChange(index, 'value', e.target.value)
              }
              variant="outlined"
              size="small"
              multiline
              maxRows={3}
              disabled={!isFromImage}
            />
            <IconButton
              size="small"
              onClick={() => handleRemoveFileMount(index)}
              className={classes.deleteButton}
              disabled={!isFromImage}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddFileMount}
          color="primary"
          disabled={!isFromImage}
        >
          Add File Mount
        </Button>
      </Box>

      {/* ── Optional Parameters ── */}
      {advancedFieldCount > 0 && (
        <>
          <Divider className={classes.divider} />
          <Accordion
            expanded={advancedExpanded}
            onChange={() => setAdvancedExpanded(!advancedExpanded)}
            className={classes.accordion}
            elevation={0}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              className={classes.accordionSummary}
            >
              <Box display="flex" alignItems="center">
                <Typography variant="subtitle2">
                  Optional Parameters
                </Typography>
                <Chip
                  label={advancedFieldCount}
                  size="small"
                  color="default"
                  className={classes.chip}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              <Typography variant="body2" color="textSecondary" paragraph>
                These settings have sensible defaults. Modify only if needed.
              </Typography>
              <Form
                schema={advancedSchema}
                uiSchema={advancedUiSchema}
                formData={advancedFormData}
                onChange={handleCtdAdvancedChange}
                validator={validator}
                liveValidate={false}
                showErrorList={false}
                noHtml5Validate
                tagName="div"
              >
                <div style={{ display: 'none' }} />
              </Form>
            </AccordionDetails>
          </Accordion>
        </>
      )}

      {/* ── Traits ("Enhance Your Component") ── */}
      <Divider className={classes.divider} />
      <Typography variant="subtitle1" className={classes.sectionTitle}>
        Enhance Your Component
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Select and configure traits for your component.
      </Typography>

      {traitError && (
        <Typography variant="body2" color="error" gutterBottom>
          {traitError}
        </Typography>
      )}

      {loadingTraits && (
        <Box display="flex" alignItems="center" justifyContent="center" py={4}>
          <CircularProgress size={24} style={{ marginRight: 8 }} />
          <Typography variant="body2" color="textSecondary">
            Loading available traits...
          </Typography>
        </Box>
      )}

      {!loadingTraits && availableTraits.length === 0 && namespaceName && (
        <NoTraitsAvailableMessage />
      )}

      {!loadingTraits && availableTraits.length > 0 && (
        <TraitPicker
          availableTraits={availableTraits}
          addedTraitNames={addedTraitNames}
          onAddTrait={handleAddTrait}
          loading={loadingTraits}
          loadingTraitName={loadingTraitName || undefined}
        />
      )}

      {addedTraits.length > 0 && (
        <Box mt={3}>
          <Typography variant="subtitle1" gutterBottom>
            Configured Traits ({addedTraits.length})
          </Typography>
          {addedTraits.map((trait, index) => (
            <Accordion
              key={trait.id}
              expanded={expandedTrait === trait.id}
              onChange={(_e, isExpanded) =>
                setExpandedTrait(isExpanded ? trait.id : false)
              }
              className={classes.traitAccordion}
              elevation={0}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                className={classes.traitSummary}
              >
                <Box className={classes.traitSummaryContent}>
                  <Box display="flex" alignItems="center">
                    <Typography className={classes.traitTitle}>
                      {trait.instanceName || `${trait.name} #${index + 1}`}
                    </Typography>
                    <Typography className={classes.traitName}>
                      ({trait.name})
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={e => {
                      e.stopPropagation();
                      handleRemoveTrait(trait.id);
                    }}
                    size="small"
                    className={classes.deleteButton}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                <Box mb={2}>
                  <TextField
                    label="Instance Name"
                    value={trait.instanceName || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleTraitInstanceNameChange(trait.id, e.target.value)
                    }
                    fullWidth
                    required
                    variant="outlined"
                    size="small"
                    helperText="A unique name to identify this trait instance"
                  />
                </Box>

                {trait.schema && (
                  <Form
                    schema={trait.schema}
                    uiSchema={trait.uiSchema || {}}
                    formData={trait.config}
                    onChange={data =>
                      handleTraitConfigChange(trait.id, data.formData)
                    }
                    validator={validator}
                    showErrorList={false}
                    tagName="div"
                    children={<div />}
                  />
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * Validation function for WorkloadDetailsField
 */
export const workloadDetailsFieldValidation = (
  value: WorkloadDetailsData,
  validation: any,
) => {
  if (!value) return;

  // Validate trait instance names are unique
  if (value.traits && value.traits.length > 0) {
    const instanceNames = new Set<string>();
    value.traits.forEach((trait, index) => {
      if (!trait.instanceName || trait.instanceName.trim() === '') {
        validation.addError(`Trait #${index + 1}: Instance name is required`);
        return;
      }
      if (instanceNames.has(trait.instanceName)) {
        validation.addError(
          `Trait #${index + 1}: Instance name "${
            trait.instanceName
          }" is already used.`,
        );
      } else {
        instanceNames.add(trait.instanceName);
      }
    });
  }

  // Validate env var keys are non-empty when values exist
  if (value.envVars) {
    value.envVars.forEach((ev, index) => {
      if (ev.value && !ev.key) {
        validation.addError(
          `Environment Variable #${
            index + 1
          }: Key is required when value is set`,
        );
      }
    });
  }

  // Validate file mount keys and mount paths
  if (value.fileMounts) {
    value.fileMounts.forEach((fm, index) => {
      if ((fm.value || fm.mountPath) && !fm.key) {
        validation.addError(`File Mount #${index + 1}: Filename is required`);
      }
      if ((fm.value || fm.key) && !fm.mountPath) {
        validation.addError(`File Mount #${index + 1}: Mount path is required`);
      }
    });
  }
};
