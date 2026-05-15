import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { Progress } from '@backstage/core-components';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import { RjsfForm } from '@openchoreo/backstage-design-system';
import YAML from 'yaml';
import { useStyles } from './styles';

type ResourceTypeKind = 'ResourceType' | 'ClusterResourceType';

interface FormContextData {
  namespace_name?: string;
  project_name?: string;
  resource_name?: string;
  displayName?: string;
  description?: string;
}

// `domain:default/finance` → `finance`
function extractNsName(value?: string): string {
  if (!value) return '';
  const parts = value.split('/');
  return parts[parts.length - 1];
}

// `system:default/analytics` → `analytics`
function extractProjectName(value?: string): string {
  if (!value) return '';
  const parts = value.split('/');
  return parts[parts.length - 1];
}

function buildResourceYaml(args: {
  formCtx: FormContextData;
  typeKind: ResourceTypeKind;
  typeName: string;
  parameters: Record<string, unknown>;
}): string {
  const { formCtx, typeKind, typeName, parameters } = args;
  const namespace = extractNsName(formCtx.namespace_name);
  const projectName = extractProjectName(formCtx.project_name);
  const annotations: Record<string, string> = {};
  if (formCtx.displayName) {
    annotations['openchoreo.dev/display-name'] = formCtx.displayName;
  }
  if (formCtx.description) {
    annotations['openchoreo.dev/description'] = formCtx.description;
  }

  const doc: Record<string, unknown> = {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: formCtx.resource_name || '',
      ...(namespace && { namespace }),
      ...(Object.keys(annotations).length > 0 && { annotations }),
    },
    spec: {
      owner: { projectName },
      type: { kind: typeKind, name: typeName },
      ...(Object.keys(parameters).length > 0 && { parameters }),
    },
  };

  return YAML.stringify(doc, { indent: 2 });
}

export const ResourceYamlEditorExtension = ({
  onChange,
  rawErrors,
  formContext,
  formData,
}: FieldExtensionComponentProps<string>) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const formCtx = (formContext?.formData ?? {}) as FormContextData;
  const namespaceName = extractNsName(formCtx.namespace_name);

  const [typeKind, setTypeKind] = useState<ResourceTypeKind>('ResourceType');
  const [typeName, setTypeName] = useState<string>('');
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [yamlErrorText, setYamlErrorText] = useState<string | undefined>();

  const lastGeneratedYamlRef = useRef<string | undefined>(undefined);

  // Fetch the selected (Cluster)ResourceType's parameters schema. Re-runs
  // whenever the kind/name picker or the namespace context changes. Always
  // clears `parameters` on a (kind, name) change so old form values from a
  // different schema don't bleed into the regenerated YAML.
  useEffect(() => {
    let cancelled = false;
    setParameters({});

    if (!typeName.trim()) {
      setSchema(null);
      setSchemaError(null);
      return undefined;
    }
    if (typeKind === 'ResourceType' && !namespaceName) {
      setSchema(null);
      setSchemaError('Pick a namespace before loading the ResourceType schema.');
      return undefined;
    }

    setSchemaLoading(true);
    setSchemaError(null);

    const run = async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const url =
          typeKind === 'ClusterResourceType'
            ? `${baseUrl}/cluster-resource-type-schema?crtName=${encodeURIComponent(
                typeName,
              )}`
            : `${baseUrl}/resource-type-schema?namespaceName=${encodeURIComponent(
                namespaceName,
              )}&rtName=${encodeURIComponent(typeName)}`;

        const response = await fetchApi.fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (cancelled) return;

        const schemaPayload = (result?.data ?? result) as
          | Record<string, unknown>
          | undefined;
        setSchema(schemaPayload ?? null);
      } catch (err) {
        if (!cancelled) {
          setSchema(null);
          setSchemaError(
            err instanceof Error
              ? err.message
              : `Failed to fetch schema: ${err}`,
          );
        }
      } finally {
        if (!cancelled) setSchemaLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi, typeKind, typeName, namespaceName]);

  // Regenerate the YAML whenever the picker, parameters, or upstream
  // form context changes — but only overwrite editor content the user
  // hasn't manually edited (i.e. unchanged from our last auto-generation
  // or empty).
  useEffect(() => {
    if (!typeName.trim()) return;
    const generated = buildResourceYaml({
      formCtx,
      typeKind,
      typeName,
      parameters,
    });
    if (!formData || formData === lastGeneratedYamlRef.current) {
      onChange(generated);
      lastGeneratedYamlRef.current = generated;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    typeKind,
    typeName,
    parameters,
    formCtx.namespace_name,
    formCtx.project_name,
    formCtx.resource_name,
    formCtx.displayName,
    formCtx.description,
  ]);

  const handleYamlChange = useCallback(
    (content: string) => {
      onChange(content);
      try {
        YAML.parse(content);
        setYamlErrorText(undefined);
      } catch (err) {
        setYamlErrorText(`YAML parse error: ${err}`);
      }
    },
    [onChange],
  );

  return (
    <Box>
      <Typography className={classes.helpText} component="div">
        <span>
          Pick a ResourceType or ClusterResourceType, fill in its parameters,
          then review or hand-edit the generated YAML below.
        </span>
      </Typography>

      <Box className={classes.pickerRow}>
        <TextField
          select
          label="Type Kind"
          value={typeKind}
          onChange={e => setTypeKind(e.target.value as ResourceTypeKind)}
          variant="outlined"
          size="small"
          className={classes.pickerField}
        >
          <MenuItem value="ResourceType">ResourceType (namespace)</MenuItem>
          <MenuItem value="ClusterResourceType">
            ClusterResourceType (cluster)
          </MenuItem>
        </TextField>
        <TextField
          label="Type Name"
          value={typeName}
          onChange={e => setTypeName(e.target.value)}
          placeholder="e.g. postgres"
          variant="outlined"
          size="small"
          className={classes.pickerField}
          helperText="The (Cluster)ResourceType template to consume"
        />
      </Box>

      <Box className={classes.paramsBox}>
        <Typography className={classes.paramsTitle}>Parameters</Typography>
        {schemaLoading && <Progress />}
        {!schemaLoading && schemaError && (
          <Typography className={classes.schemaError}>{schemaError}</Typography>
        )}
        {!schemaLoading && !schemaError && !schema && (
          <Typography className={classes.emptyState}>
            Enter a type name above to load its parameters schema.
          </Typography>
        )}
        {!schemaLoading && schema && (
          <RjsfForm
            schema={schema as any}
            uiSchema={{}}
            formData={parameters}
            onChange={data => setParameters(data.formData || {})}
            tagName="div"
          />
        )}
      </Box>

      <Box className={classes.yamlContainer}>
        <YamlEditor
          content={formData || ''}
          onChange={handleYamlChange}
          errorText={yamlErrorText}
        />
      </Box>
      {rawErrors && rawErrors.length > 0 && (
        <Box className={classes.errorText}>{rawErrors.join(', ')}</Box>
      )}
    </Box>
  );
};

export const resourceYamlEditorValidation = (
  value: string,
  validation: FieldValidation,
) => {
  if (!value || value.trim() === '') {
    validation.addError('Resource YAML definition is required');
    return;
  }

  try {
    const parsed = YAML.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      validation.addError('YAML content must be a valid object');
      return;
    }
    if (parsed.kind !== 'Resource') {
      validation.addError('Kind must be Resource');
    }
    if (parsed.apiVersion !== 'openchoreo.dev/v1alpha1') {
      validation.addError("apiVersion must be 'openchoreo.dev/v1alpha1'");
    }
    if (!parsed.metadata?.name) {
      validation.addError('metadata.name is required');
    }
    if (!parsed.spec?.owner?.projectName) {
      validation.addError('spec.owner.projectName is required');
    }
    if (!parsed.spec?.type?.name) {
      validation.addError('spec.type.name is required');
    }
    const kind = parsed.spec?.type?.kind;
    if (kind !== 'ResourceType' && kind !== 'ClusterResourceType') {
      validation.addError(
        'spec.type.kind must be either "ResourceType" or "ClusterResourceType"',
      );
    }
  } catch (err) {
    validation.addError(`Invalid YAML: ${err}`);
  }
};
