import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { Box } from '@material-ui/core';
import toIdSchema from '@rjsf/utils/lib/schema/toIdSchema';

const BRANCH_FIELDS: Record<string, string[]> = {
  'build-from-source': ['workflow_name', 'git_source', 'workflow_parameters'],
  'deploy-from-image': ['containerImage', 'autoDeploy'],
  'external-ci': ['ciPlatform', 'ciIdentifier'],
};

const CI_PLATFORMS_WITH_IDENTIFIER = new Set([
  'jenkins',
  'github-actions',
  'gitlab-ci',
]);

/**
 * Composite field that owns the entire "Build & Deploy" object.
 *
 * Why this exists: RJSF's `dependencies + oneOf` doesn't clear stale data
 * from the inactive branch when the discriminator changes, and Backstage's
 * scaffolder Stepper deliberately strips RJSF's `omitExtraData`/`liveOmit`
 * props that would otherwise enable that. By making the entire object live
 * under one custom field, we can replace the object atomically on source
 * change — the previous branch's keys vanish in a single onChange call.
 */
export const BuildAndDeployField = (
  props: FieldExtensionComponentProps<any>,
) => {
  const {
    formData = {},
    onChange,
    schema,
    uiSchema = {},
    idSchema,
    errorSchema,
    registry,
    formContext,
    required,
    disabled,
    readonly,
    onBlur,
    onFocus,
  } = props;

  const { SchemaField } = registry.fields;
  const properties = (schema.properties ?? {}) as Record<string, any>;
  const currentSource = formData.deploymentSource as string | undefined;
  const currentCiPlatform = formData.ciPlatform as string | undefined;

  const visibleFields = [
    'deploymentSource',
    ...(BRANCH_FIELDS[currentSource ?? ''] ?? []),
  ]
    .filter(field => {
      if (field === 'ciIdentifier') {
        return (
          currentSource === 'external-ci' &&
          currentCiPlatform !== undefined &&
          CI_PLATFORMS_WITH_IDENTIFIER.has(currentCiPlatform)
        );
      }
      return true;
    })
    .filter(field => properties[field]);

  const renderChild = (field: string) => {
    const childSchema = properties[field];
    const childUiSchema = (uiSchema as any)[field] ?? {};
    const childFormData = formData[field];
    const baseId = idSchema?.$id ?? 'root';
    const childIdSchema =
      (idSchema as any)?.[field] ??
      toIdSchema(
        registry.schemaUtils.getValidator(),
        childSchema,
        `${baseId}_${field}`,
        registry.rootSchema,
        childFormData,
      );
    const childErrorSchema = (errorSchema as any)?.[field];
    const isRequired = (schema.required ?? []).includes(field);

    const handleChildChange = (value: any) => {
      if (field === 'deploymentSource' && value !== currentSource) {
        // Replace the whole object so siblings from the previous branch
        // disappear atomically. Keep no other keys.
        onChange({ deploymentSource: value });
        return;
      }

      let next: Record<string, any> = { ...formData, [field]: value };

      // Within external-ci, dropping ciIdentifier when ciPlatform changes
      // to one that doesn't use it (e.g. 'none') avoids the same stale-data
      // class of bug at the nested level.
      if (field === 'ciPlatform') {
        if (!CI_PLATFORMS_WITH_IDENTIFIER.has(value)) {
          const { ciIdentifier: _ciIdentifier, ...rest } = next;
          next = rest;
        }
      }

      onChange(next);
    };

    return (
      <SchemaField
        key={field}
        name={field}
        schema={childSchema}
        uiSchema={childUiSchema}
        formData={childFormData}
        onChange={handleChildChange}
        idSchema={childIdSchema}
        errorSchema={childErrorSchema}
        registry={registry}
        formContext={formContext}
        required={isRequired}
        disabled={disabled}
        readonly={readonly}
        onBlur={onBlur}
        onFocus={onFocus}
      />
    );
  };

  return (
    <Box>
      {schema.title && (
        <Box mb={1} mt={2}>
          <strong>{schema.title}</strong>
        </Box>
      )}
      {visibleFields.map(renderChild)}
      {!required && null}
    </Box>
  );
};

export const BuildAndDeployFieldSchema = {
  returnValue: {
    type: 'object' as const,
  },
};
