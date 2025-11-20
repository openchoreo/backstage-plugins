import { ChangeEvent } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { Box, Typography, Switch } from '@material-ui/core';

/**
 * SwitchField component
 * Renders a switch toggle for boolean fields
 */
export const SwitchField = ({
  onChange,
  rawErrors,
  formData,
  schema,
}: FieldExtensionComponentProps<boolean>) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
  };

  const title = schema.title || 'Toggle';
  const description = schema.description;

  return (
    <Box mt={2} mb={2}>
      <Box display="flex" alignItems="center">
        <Box style={{ marginRight: 16 }}>
          <Typography
            variant="body1"
            style={{ fontSize: '1.125rem', marginBottom: 4 }}
          >
            {title}
          </Typography>
        </Box>
        <Switch
          checked={formData || false}
          onChange={handleChange}
          color="primary"
        />
      </Box>
      {description && (
        <Typography variant="body2" color="textSecondary">
          {description}
        </Typography>
      )}
      {rawErrors?.length ? (
        <Typography variant="body2" color="error" style={{ marginTop: 8 }}>
          {rawErrors.join(', ')}
        </Typography>
      ) : null}
    </Box>
  );
};

export const SwitchFieldSchema = {
  returnValue: {
    type: 'boolean' as const,
  },
};
