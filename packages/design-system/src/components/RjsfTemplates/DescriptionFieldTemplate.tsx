import { Typography } from '@material-ui/core';
import type { DescriptionFieldProps } from '@rjsf/utils';

export function DescriptionFieldTemplate({
  description,
}: DescriptionFieldProps) {
  if (!description) return null;

  return (
    <Typography variant="caption" color="textSecondary">
      {description}
    </Typography>
  );
}

DescriptionFieldTemplate.displayName = 'DescriptionFieldTemplate';
