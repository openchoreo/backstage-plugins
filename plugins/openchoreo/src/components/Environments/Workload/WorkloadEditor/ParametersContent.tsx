import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, CircularProgress } from '@material-ui/core';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useEntity, catalogApiRef } from '@backstage/plugin-catalog-react';
import Form from '@rjsf/material-ui';
import { JSONSchema7 } from 'json-schema';
import validator from '@rjsf/validator-ajv8';
import {
  sanitizeLabel,
  CHOREO_ANNOTATIONS,
} from '@openchoreo/backstage-plugin-common';

interface ParametersContentProps {
  parameters: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

/**
 * Recursively generates a UI Schema with sanitized titles for fields
 * that don't already have a title in the JSON Schema.
 */
function generateUiSchemaWithTitles(schema: any): any {
  if (!schema || typeof schema !== 'object') return {};

  const uiSchema: any = {};

  if (schema.properties) {
    Object.entries(schema.properties).forEach(
      ([key, propSchema]: [string, any]) => {
        if (!propSchema || typeof propSchema !== 'object') return;

        const fieldUiSchema: any = {};
        if (!propSchema.title) {
          fieldUiSchema['ui:title'] = sanitizeLabel(key);
        }
        uiSchema[key] = fieldUiSchema;

        if (propSchema.type === 'object' && propSchema.properties) {
          uiSchema[key] = {
            ...uiSchema[key],
            ...generateUiSchemaWithTitles(propSchema),
          };
        }
        if (propSchema.type === 'array' && propSchema.items) {
          const itemsUiSchema = generateUiSchemaWithTitles(propSchema.items);
          if (Object.keys(itemsUiSchema).length > 0) {
            uiSchema[key] = { ...uiSchema[key], items: itemsUiSchema };
          }
        }
      },
    );
  }

  return uiSchema;
}

export const ParametersContent = ({
  parameters,
  onChange,
  disabled,
}: ParametersContentProps) => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);

  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const componentTypeName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE];
  const componentTypeKind =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE_KIND];
  const isClusterCT = componentTypeKind === 'ClusterComponentType';

  // Fetch the component type schema for parameters
  useEffect(() => {
    let ignore = false;

    const fetchSchema = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!componentTypeName) {
          setLoading(false);
          return;
        }

        // Find the component type entity to get its schema
        const ctKind = isClusterCT
          ? 'ClusterComponentType'
          : 'ComponentType';
        const ctEntities = await catalogApi.getEntities({
          filter: { kind: ctKind },
        });

        const matchingCt = ctEntities.items.find(
          e =>
            `${e.spec?.workloadType}/${e.metadata.name}` === componentTypeName,
        );

        if (!matchingCt) {
          if (!ignore) setLoading(false);
          return;
        }

        // Fetch the schema from the backend
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const schemaUrl = isClusterCT
          ? `${baseUrl}/cluster-component-type-schema?clusterComponentTypeName=${encodeURIComponent(matchingCt.metadata.name)}`
          : `${baseUrl}/component-release-schema?namespaceName=${encodeURIComponent(
              entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '',
            )}&componentName=${encodeURIComponent(entity.metadata.name)}`;

        const response = await fetchApi.fetch(schemaUrl);

        if (response.ok) {
          const result = await response.json();
          if (!ignore && result.success && result.data) {
            setSchema(result.data);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to load parameters schema: ${err}`);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchSchema();
    return () => {
      ignore = true;
    };
  }, [
    entity,
    componentTypeName,
    isClusterCT,
    discoveryApi,
    fetchApi,
    catalogApi,
  ]);

  const uiSchema = useMemo(
    () => (schema ? generateUiSchemaWithTitles(schema) : {}),
    [schema],
  );

  if (loading) {
    return (
      <Box display="flex" alignItems="center" p={3} justifyContent="center">
        <CircularProgress size={24} />
        <Typography variant="body2" style={{ marginLeft: 12 }}>
          Loading parameters schema...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!schema) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="textSecondary">
          No parameter schema available for this component type.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Parameters
      </Typography>
      <Form
        schema={schema}
        uiSchema={uiSchema}
        formData={parameters}
        onChange={data => onChange(data.formData)}
        validator={validator}
        liveValidate
        showErrorList={false}
        noHtml5Validate
        omitExtraData
        tagName="div"
        disabled={disabled}
        children={<div />}
      />
    </Box>
  );
};
