import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { RjsfForm } from '@openchoreo/backstage-design-system';
import type { JSONSchema7 } from 'json-schema';

const useStyles = makeStyles(theme => ({
  helpText: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    marginBottom: theme.spacing(1.5),
  },
  emptyState: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
}));

/**
 * `ResourceParametersField` renders the parameters form for a per-type
 * Resource scaffolder template. The schema is supplied by
 * `RtdToTemplateConverter` via `ui:options.rtdSchema` (snapshotted from
 * the picked `(Cluster)ResourceType.spec.parameters.openAPIV3Schema` at
 * template-generation time), so the field is purely a thin RJSF wrapper.
 */
export const ResourceParametersField = ({
  onChange,
  formData,
  uiSchema,
}: FieldExtensionComponentProps<Record<string, unknown>>) => {
  const classes = useStyles();

  const rtdSchema = uiSchema?.['ui:options']?.rtdSchema as
    | JSONSchema7
    | undefined;
  const rtdDisplayName =
    typeof uiSchema?.['ui:options']?.rtdDisplayName === 'string'
      ? uiSchema['ui:options'].rtdDisplayName
      : 'this resource';

  const hasFields =
    rtdSchema?.properties && Object.keys(rtdSchema.properties).length > 0;

  if (!hasFields) {
    return (
      <Box>
        <Typography className={classes.emptyState}>
          {`${rtdDisplayName} has no configurable parameters.`}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography className={classes.helpText} component="div">
        Fill in the parameters defined by {rtdDisplayName}.
      </Typography>
      <RjsfForm
        schema={rtdSchema as any}
        uiSchema={{}}
        formData={formData ?? {}}
        onChange={data => onChange(data.formData ?? {})}
        tagName="div"
      />
    </Box>
  );
};

/**
 * Field-level JSON schema declared on this extension. The actual parameter
 * schema is per-template (carried at runtime via `ui:options.rtdSchema`);
 * at the extension level we just declare the field as an arbitrary object.
 */
export const ResourceParametersFieldSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};
