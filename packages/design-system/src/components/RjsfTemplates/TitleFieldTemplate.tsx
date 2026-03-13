import { Typography, Box, Divider } from '@material-ui/core';
import type { TitleFieldProps } from '@rjsf/utils';
import { humanizeTitle } from './utils';

export function TitleFieldTemplate({ title }: TitleFieldProps) {
  if (!title) return null;

  return (
    <Box mb={1} mt={0.5}>
      <Typography variant="h5" style={{ fontWeight: 600 }}>
        {humanizeTitle(title)}
      </Typography>
      <Divider />
    </Box>
  );
}

TitleFieldTemplate.displayName = 'TitleFieldTemplate';
