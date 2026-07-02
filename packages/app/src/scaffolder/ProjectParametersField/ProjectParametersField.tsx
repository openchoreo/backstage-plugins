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
 * `ProjectParametersField` renders the parameters form for a per-type
 * Project scaffolder template. The schema is supplied by
 * `PtdToTemplateConverter` via `ui:options.ptdSchema` (read from the picked
 * `(Cluster)ProjectType.spec.parameters.openAPIV3Schema` at template-generation
 * time), so the field is purely a thin RJSF wrapper. Mirrors
 * `ResourceParametersField`.
 */
export const ProjectParametersField = ({
  onChange,
  formData,
  uiSchema,
}: FieldExtensionComponentProps<Record<string, unknown>>) => {
  const classes = useStyles();

  const ptdSchema = uiSchema?.['ui:options']?.ptdSchema as
    | JSONSchema7
    | undefined;
  const ptdDisplayName =
    typeof uiSchema?.['ui:options']?.ptdDisplayName === 'string'
      ? uiSchema['ui:options'].ptdDisplayName
      : 'this project';

  const hasFields =
    ptdSchema?.properties && Object.keys(ptdSchema.properties).length > 0;

  if (!hasFields) {
    return (
      <Box>
        <Typography className={classes.emptyState}>
          {`${ptdDisplayName} has no configurable parameters.`}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography className={classes.helpText} component="div">
        Fill in the parameters defined by {ptdDisplayName}.
      </Typography>
      <RjsfForm
        schema={ptdSchema as any}
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
 * schema is per-template (carried at runtime via `ui:options.ptdSchema`);
 * at the extension level we just declare the field as an arbitrary object.
 */
export const ProjectParametersFieldSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};
