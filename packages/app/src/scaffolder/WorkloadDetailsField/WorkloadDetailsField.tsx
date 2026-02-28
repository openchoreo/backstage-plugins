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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Link,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import DeleteIcon from '@material-ui/icons/Delete';
import { useApi } from '@backstage/core-plugin-api';
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
  StandardEnvVarList,
  StandardFileVarList,
  useEnvVarEditBuffer,
  useFileVarEditBuffer,
  useModeState,
  YamlEditor,
  TraitConfigToggle,
} from '@openchoreo/backstage-plugin-react';
import type { SecretOption } from '@openchoreo/backstage-design-system';
import type {
  WorkloadEndpoint as CommonWorkloadEndpoint,
  EnvVar,
  FileVar,
  Container,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '@openchoreo/backstage-plugin';

const CONTAINER_NAME = 'main';

const SAMPLE_WORKLOAD_YAML = `# workload.yaml — place this file in your source repository root
apiVersion: openchoreo.dev/v1
kind: WorkloadDescriptor
metadata:
  name: my-service

# Endpoints expose your service to the network
endpoints:
  - name: http
    port: 8080
    type: HTTP
  - name: grpc
    port: 9090
    type: GRPC

# Container configuration
configurations:
  # Environment variables
  env:
    - key: LOG_LEVEL
      value: info
    - key: DB_HOST
      value: postgres.default.svc.cluster.local
    # Reference a secret
    - key: DB_PASSWORD
      valueFrom:
        secretRef:
          name: db-credentials
          key: password

  # File mounts — inject configuration files into the container
  files:
    - key: config.yaml
      mountPath: /etc/app/config.yaml
      value: |
        server:
          port: 8080
          readTimeout: 30s

# Connections to other components
connections:
  - name: database
    ref: my-project/postgres-db
`;

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
  },
  accordionSummary: {},
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
}));

/**
 * Data shape returned by WorkloadDetailsField
 */
export interface WorkloadDetailsData {
  ctdParameters: Record<string, any>;
  endpoints: Record<string, WorkloadEndpoint>;
  envVars: EnvVar[];
  fileMounts: FileVar[];
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
  const client = useApi(openChoreoClientApiRef);

  // Env vars and file mounts require a container with an image.
  // For build-from-source and external-ci the image isn't known yet,
  // so we hide these sections.
  const deploymentSource = (formContext as any)?.formData?.deploymentSource;
  const isFromImage = deploymentSource === 'deploy-from-image';
  const isBuildFromSource = deploymentSource === 'build-from-source';
  const isExternalCi = deploymentSource === 'external-ci';
  const showWorkloadInfoSection = isBuildFromSource || isExternalCi;
  const [workloadDescriptorDialogOpen, setWorkloadDescriptorDialogOpen] =
    useState(false);
  const [configInfoExpanded, setConfigInfoExpanded] = useState(false);

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
  const allowedTraits = uiSchema?.['ui:options']?.allowedTraits as
    | Array<{ kind?: string; name: string }>
    | undefined;
  const isDeploymentType = workloadType.startsWith('deployment');

  // State
  const [ctdParameters, setCtdParameters] = useState<Record<string, any>>(
    formData?.ctdParameters || {},
  );
  const [endpoints, setEndpoints] = useState<Record<string, WorkloadEndpoint>>(
    formData?.endpoints || {},
  );
  const [envVars, setEnvVars] = useState<EnvVar[]>(formData?.envVars || []);
  const [fileMounts, setFileMounts] = useState<FileVar[]>(
    formData?.fileMounts || [],
  );
  const [secretOptions, setSecretOptions] = useState<SecretOption[]>([]);

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
  const [advancedConfigExpanded, setAdvancedConfigExpanded] = useState(false);

  // Propagate changes to parent
  const emitChange = useCallback(
    (
      newCtd: Record<string, any>,
      newEndpoints: Record<string, WorkloadEndpoint>,
      newEnvVars: EnvVar[],
      newFileMounts: FileVar[],
      newTraits: AddedTrait[],
    ) => {
      onChange({
        ctdParameters: newCtd,
        endpoints: isFromImage ? newEndpoints : {},
        envVars: isFromImage ? newEnvVars : [],
        fileMounts: isFromImage ? newFileMounts : [],
        traits: newTraits.map(t => ({
          ...(t.kind !== undefined && { kind: t.kind }),
          name: t.name,
          instanceName: t.instanceName,
          config: t.config,
        })),
      });
    },
    [onChange, isFromImage],
  );

  // ── Container wrapper for hooks ─────────────────────────────────

  const containers = useMemo(() => {
    const c: { [key: string]: Container } = {
      [CONTAINER_NAME]: { image: 'placeholder', env: envVars },
    };
    (c[CONTAINER_NAME] as any).files = fileMounts;
    return c;
  }, [envVars, fileMounts]);

  // ── Mode state for env vars and file mounts ─────────────────────

  const envModes = useModeState({ type: 'env' });
  const fileModes = useModeState({ type: 'file' });

  // ── Fetch secret references ─────────────────────────────────────

  useEffect(() => {
    let ignore = false;
    const fetchSecrets = async () => {
      if (!namespaceName) return;
      try {
        const nsName = namespaceName.split('/').pop() || namespaceName;
        const result = await client.fetchSecretReferencesByNamespace(nsName);
        if (!ignore && result.success) {
          setSecretOptions(
            (result.data.items || []).map(ref => ({
              name: ref.name,
              displayName: ref.displayName,
              keys: (ref.data || []).map(d => d.secretKey),
            })),
          );
        }
      } catch {
        /* secrets are optional */
      }
    };
    fetchSecrets();
    return () => {
      ignore = true;
    };
  }, [namespaceName, client]);

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
    const newEndpoint: WorkloadEndpoint = {
      type: 'HTTP',
      port: 8080,
      visibility: ['external'],
    };
    const newEndpoints: Record<string, WorkloadEndpoint> = {
      ...endpoints,
      [name]: newEndpoint,
    };
    handleEndpointChange(newEndpoints);
    return name;
  }, [endpoints, handleEndpointChange]);

  // ── Environment Variables ─────────────────────────────────────

  const envEditBuffer = useEnvVarEditBuffer({
    containers,
    onEnvVarReplace: (_cn, index, envVar) => {
      const newEnvVars = envVars.map((ev, i) => (i === index ? envVar : ev));
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
    onEnvVarChange: (_cn, index, field, value) => {
      const newEnvVars = envVars.map((ev, i) =>
        i === index ? { ...ev, [field]: value } : ev,
      );
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
    onRemoveEnvVar: (_cn, index) => {
      const newEnvVars = envVars.filter((_, i) => i !== index);
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
  });

  const handleAddEnvVar = useCallback(
    (_containerName: string) => {
      const newEnvVars = [...envVars, { key: '', value: '' }];
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
    [envVars, ctdParameters, endpoints, fileMounts, addedTraits, emitChange],
  );

  const handleEnvVarChange = useCallback(
    (
      _containerName: string,
      index: number,
      field: keyof EnvVar,
      value: any,
    ) => {
      const newEnvVars = envVars.map((ev, i) =>
        i === index ? { ...ev, [field]: value } : ev,
      );
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
    [envVars, ctdParameters, endpoints, fileMounts, addedTraits, emitChange],
  );

  const handleRemoveEnvVar = useCallback(
    (_containerName: string, index: number) => {
      const newEnvVars = envVars.filter((_, i) => i !== index);
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
    [envVars, ctdParameters, endpoints, fileMounts, addedTraits, emitChange],
  );

  const handleEnvVarModeChange = useCallback(
    (_containerName: string, index: number, mode: 'plain' | 'secret') => {
      const newEnvVars = envVars.map((ev, i) => {
        if (i !== index) return ev;
        if (mode === 'plain') {
          return { ...ev, value: '', valueFrom: undefined };
        }
        return {
          ...ev,
          value: undefined,
          valueFrom: { secretRef: { name: '', key: '' } },
        };
      });
      setEnvVars(newEnvVars);
      emitChange(ctdParameters, endpoints, newEnvVars, fileMounts, addedTraits);
    },
    [envVars, ctdParameters, endpoints, fileMounts, addedTraits, emitChange],
  );

  // ── File Mounts ───────────────────────────────────────────────

  const fileEditBuffer = useFileVarEditBuffer({
    containers,
    onFileVarReplace: (_cn, index, fileVar) => {
      const newFileMounts = fileMounts.map((fm, i) =>
        i === index ? fileVar : fm,
      );
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
    onFileVarChange: (_cn, index, field, value) => {
      const newFileMounts = fileMounts.map((fm, i) =>
        i === index ? { ...fm, [field]: value } : fm,
      );
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
    onRemoveFileVar: (_cn, index) => {
      const newFileMounts = fileMounts.filter((_, i) => i !== index);
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
  });

  const handleAddFileVar = useCallback(
    (_containerName: string) => {
      const newFileMounts = [
        ...fileMounts,
        { key: '', mountPath: '', value: '' },
      ];
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
    [fileMounts, ctdParameters, endpoints, envVars, addedTraits, emitChange],
  );

  const handleFileVarChange = useCallback(
    (
      _containerName: string,
      index: number,
      field: keyof FileVar,
      value: any,
    ) => {
      const newFileMounts = fileMounts.map((fm, i) =>
        i === index ? { ...fm, [field]: value } : fm,
      );
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
    [fileMounts, ctdParameters, endpoints, envVars, addedTraits, emitChange],
  );

  const handleRemoveFileVar = useCallback(
    (_containerName: string, index: number) => {
      const newFileMounts = fileMounts.filter((_, i) => i !== index);
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
    [fileMounts, ctdParameters, endpoints, envVars, addedTraits, emitChange],
  );

  const handleFileVarModeChange = useCallback(
    (_containerName: string, index: number, mode: 'plain' | 'secret') => {
      const newFileMounts = fileMounts.map((fm, i) => {
        if (i !== index) return fm;
        if (mode === 'plain') {
          return { ...fm, value: '', valueFrom: undefined };
        }
        return {
          ...fm,
          value: undefined,
          valueFrom: { secretRef: { name: '', key: '' } },
        };
      });
      setFileMounts(newFileMounts);
      emitChange(ctdParameters, endpoints, envVars, newFileMounts, addedTraits);
    },
    [fileMounts, ctdParameters, endpoints, envVars, addedTraits, emitChange],
  );

  // ── Traits ─────────────────────────────────────────────────────

  // Traits are only allowed when allowedTraits has values
  const hasAllowedTraits =
    Array.isArray(allowedTraits) && allowedTraits.length > 0;

  // Determine what trait kinds to fetch
  const hasClusterTraits = allowedTraits?.some(t => t.kind === 'ClusterTrait');
  const hasNamespaceTraits = allowedTraits?.some(
    t => !t.kind || t.kind === 'Trait',
  );

  // Fetch available traits on mount (only when allowedTraits is specified)
  useEffect(() => {
    let ignore = false;

    const fetchTraits = async () => {
      if (!hasAllowedTraits) return;

      setLoadingTraits(true);
      setTraitError(null);

      try {
        const allItems: TraitListItem[] = [];

        // Fetch namespace-scoped traits if needed
        if (namespaceName && hasNamespaceTraits) {
          const nsName = namespaceName.split('/').pop() || namespaceName;
          const result = await client.fetchTraitsByNamespace(nsName, 1, 100);
          if (result.success) {
            allItems.push(...(result.data.items as TraitListItem[]));
          }
        }

        // Fetch cluster-scoped traits if needed
        if (hasClusterTraits) {
          const result = await client.fetchClusterTraits();
          if (result.success) {
            const clusterItems = (result.data.items || []).map(
              (t: TraitListItem) => ({
                ...t,
                kind: 'ClusterTrait' as const,
              }),
            );
            allItems.push(...clusterItems);
          }
        }

        if (!ignore) {
          setAvailableTraits(
            allItems.filter((t: TraitListItem) =>
              allowedTraits!.some(
                at =>
                  at.name === t.name &&
                  (at.kind ?? 'Trait') === (t.kind ?? 'Trait'),
              ),
            ),
          );
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
  }, [
    namespaceName,
    client,
    allowedTraits,
    hasAllowedTraits,
    hasClusterTraits,
    hasNamespaceTraits,
  ]);

  // Re-fetch schemas for restored traits that are missing them
  useEffect(() => {
    let ignore = false;

    const hydrateRestoredTraits = async () => {
      const traitsNeedingSchema = addedTraits.filter(t => !t.schema);
      if (traitsNeedingSchema.length === 0) return;

      const nsName = namespaceName
        ? namespaceName.split('/').pop() || namespaceName
        : '';
      const hydrated = await Promise.all(
        addedTraits.map(async trait => {
          if (trait.schema) return trait;
          try {
            let result;
            if (trait.kind === 'ClusterTrait') {
              result = await client.fetchClusterTraitSchema(trait.name);
            } else if (nsName) {
              result = await client.fetchTraitSchemaByNamespace(
                nsName,
                trait.name,
              );
            } else {
              return trait;
            }
            if (result.success) {
              return {
                ...trait,
                schema: result.data,
                uiSchema: generateUiSchemaWithTitles(result.data),
              };
            }
          } catch {
            /* keep trait without schema */
          }
          return trait;
        }),
      );

      if (!ignore) {
        setAddedTraits(hydrated);
      }
    };

    hydrateRestoredTraits();
    return () => {
      ignore = true;
    };
    // Only run on mount — addedTraits intentionally excluded to avoid re-triggering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaceName, client]);

  const handleAddTrait = useCallback(
    async (traitName: string) => {
      if (!traitName) return;

      // Determine trait kind from available traits
      const matchedTrait = availableTraits.find(t => t.name === traitName);
      const traitKind: 'Trait' | 'ClusterTrait' =
        matchedTrait?.kind === 'ClusterTrait' ? 'ClusterTrait' : 'Trait';
      const isClusterTrait = traitKind === 'ClusterTrait';

      if (!isClusterTrait && !namespaceName) return;

      setLoadingTraitName(traitName);
      setTraitError(null);

      try {
        let result;
        if (isClusterTrait) {
          result = await client.fetchClusterTraitSchema(traitName);
        } else {
          const nsName = namespaceName.split('/').pop() || namespaceName;
          result = await client.fetchTraitSchemaByNamespace(nsName, traitName);
        }

        if (result.success) {
          const schema = result.data;
          const generatedUiSchema = generateUiSchemaWithTitles(schema);

          const existingCount = addedTraits.filter(
            t => t.name === traitName,
          ).length;

          const newTrait: AddedTrait = {
            id: `${traitName}-${Date.now()}`,
            name: traitName,
            kind: traitKind,
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
      availableTraits,
      ctdParameters,
      endpoints,
      envVars,
      fileMounts,
      client,
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

      {/* ── Workload configuration info (build-from-source & external-ci) ── */}
      {showWorkloadInfoSection && (
        <>
          <Divider className={classes.divider} />
          <Accordion
            expanded={configInfoExpanded}
            onChange={() => setConfigInfoExpanded(!configInfoExpanded)}
            className={classes.accordion}
            elevation={0}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              className={classes.accordionSummary}
            >
              <Box display="flex" alignItems="center">
                <InfoOutlinedIcon
                  color="primary"
                  fontSize="small"
                  style={{ marginRight: 8 }}
                />
                <Typography variant="subtitle2" color="primary">
                  How do I define endpoints, environment variables, and file
                  mounts?
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              <Typography variant="body2" color="textSecondary" component="div">
                You have two options:
                <ol>
                  <li>
                    {isBuildFromSource ? (
                      <>
                        <strong>Commit a workload descriptor</strong> — Place a{' '}
                        <code>workload.yaml</code> file at the root of your
                        application path in the repository. Endpoints,
                        environment variables, and file mounts defined in this
                        file will be automatically applied during the CI build.
                      </>
                    ) : (
                      <>
                        <strong>Configure via your CI pipeline</strong> — Use
                        the{' '}
                        <a
                          href="https://openchoreo.dev/docs/user-guide/ci/external-ci/#workload-api"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Workload API
                        </a>{' '}
                        to define endpoints, environment variables, and file
                        mounts from your external CI pipeline.
                      </>
                    )}
                  </li>
                  <li>
                    <strong>Configure from the Deploy page</strong> — Once a
                    build completes and the workload is created, go to the
                    component's <strong>Deploy</strong> page and click{' '}
                    <strong>Configure</strong> to define them manually.
                  </li>
                </ol>
              </Typography>
              {isBuildFromSource && (
                <Box mt={1}>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      setWorkloadDescriptorDialogOpen(true);
                    }}
                  >
                    View workload.yaml reference
                  </Link>
                </Box>
              )}
              {isExternalCi && (
                <Box mt={1}>
                  <Link
                    href="https://openchoreo.dev/docs/user-guide/ci/external-ci/"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2"
                  >
                    View External CI Integration Guide
                  </Link>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </>
      )}

      {/* ── Endpoints (deployment types only, only for deploy-from-image) ── */}
      {isDeploymentType && isFromImage && (
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

      {/* ── Container Configuration (env vars + file mounts, only for deploy-from-image) ── */}
      {isFromImage && (
        <>
          <Divider className={classes.divider} />
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Container Configuration
          </Typography>

          {/* Environment Variables */}
          <Typography variant="subtitle2" className={classes.sectionTitle}>
            Environment Variables
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Define environment variables for your component.
          </Typography>
          <StandardEnvVarList
            containerName={CONTAINER_NAME}
            envVars={envVars}
            secretOptions={secretOptions}
            envModes={envModes}
            disabled={false}
            editBuffer={envEditBuffer}
            onEnvVarChange={handleEnvVarChange}
            onRemoveEnvVar={handleRemoveEnvVar}
            onEnvVarModeChange={handleEnvVarModeChange}
            onAddEnvVar={handleAddEnvVar}
          />

          {/* File Mounts */}
          <Box mt={3}>
            <Typography variant="subtitle2" className={classes.sectionTitle}>
              File Mounts
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Mount configuration files into your component.
            </Typography>
            <StandardFileVarList
              containerName={CONTAINER_NAME}
              fileVars={fileMounts}
              secretOptions={secretOptions}
              fileModes={fileModes}
              disabled={false}
              editBuffer={fileEditBuffer}
              onFileVarChange={handleFileVarChange}
              onRemoveFileVar={handleRemoveFileVar}
              onFileVarModeChange={handleFileVarModeChange}
              onAddFileVar={handleAddFileVar}
            />
          </Box>
        </>
      )}

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
                <Typography variant="subtitle2">Optional Parameters</Typography>
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

      {/* ── Traits ("Advanced Configurations") — hidden when no allowed traits ── */}
      {hasAllowedTraits && (
        <>
          <Divider className={classes.divider} />
          <Accordion
            expanded={advancedConfigExpanded}
            onChange={() => setAdvancedConfigExpanded(!advancedConfigExpanded)}
            className={classes.accordion}
            elevation={0}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              className={classes.accordionSummary}
            >
              <Typography variant="subtitle2">
                Advanced Configurations
              </Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Select and configure traits for your component.
              </Typography>

              {traitError && (
                <Typography variant="body2" color="error" gutterBottom>
                  {traitError}
                </Typography>
              )}

              {loadingTraits && (
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  py={4}
                >
                  <CircularProgress size={24} style={{ marginRight: 8 }} />
                  <Typography variant="body2" color="textSecondary">
                    Loading available traits...
                  </Typography>
                </Box>
              )}

              {!loadingTraits &&
                availableTraits.length === 0 &&
                namespaceName && <NoTraitsAvailableMessage />}

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
                              {trait.instanceName ||
                                `${trait.name} #${index + 1}`}
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
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) =>
                              handleTraitInstanceNameChange(
                                trait.id,
                                e.target.value,
                              )
                            }
                            fullWidth
                            required
                            variant="outlined"
                            size="small"
                            helperText="A unique name to identify this trait instance"
                          />
                        </Box>

                        {trait.schema && (
                          <TraitConfigToggle
                            schema={trait.schema}
                            formData={trait.config}
                            onChange={data =>
                              handleTraitConfigChange(trait.id, data)
                            }
                          >
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
                          </TraitConfigToggle>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </>
      )}

      {/* ── Workload Descriptor Reference Dialog ── */}
      <Dialog
        open={workloadDescriptorDialogOpen}
        onClose={() => setWorkloadDescriptorDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          style: { borderRadius: 16 },
        }}
      >
        <DialogTitle>Workload Descriptor Reference</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            A workload descriptor (<code>workload.yaml</code>) allows you to
            define endpoints, environment variables, file mounts, and
            connections directly in your source repository. Place this file in
            the root of your repository and it will be used during the build
            process.
          </Typography>
          <Box style={{ height: 400 }}>
            <YamlEditor
              content={SAMPLE_WORKLOAD_YAML}
              onChange={() => {}}
              readOnly
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setWorkloadDescriptorDialogOpen(false)}
            color="primary"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
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
      const hasValue = ev.value || ev.valueFrom?.secretRef?.name;
      if (hasValue && !ev.key) {
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
      const hasValue = fm.value || fm.valueFrom?.secretRef?.name;
      if ((hasValue || fm.mountPath) && !fm.key) {
        validation.addError(`File Mount #${index + 1}: Filename is required`);
      }
      if ((hasValue || fm.key) && !fm.mountPath) {
        validation.addError(`File Mount #${index + 1}: Mount path is required`);
      }
    });
  }
};
