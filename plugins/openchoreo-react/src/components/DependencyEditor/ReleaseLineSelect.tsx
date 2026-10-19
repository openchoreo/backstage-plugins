import type { FC } from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@material-ui/core';

export interface ReleaseLineOption {
  name: string;
}

export interface ReleaseLineSelectProps {
  labelId: string;
  value?: string;
  releaseLines: ReleaseLineOption[];
  onChange: (releaseLine: string) => void;
  disabled?: boolean;
}

/** Required release line picker for a target component with release lines enabled. */
export const ReleaseLineSelect: FC<ReleaseLineSelectProps> = ({
  labelId,
  value,
  releaseLines,
  onChange,
  disabled = false,
}) => (
  <FormControl
    fullWidth
    variant="outlined"
    size="small"
    required
    error={!value}
  >
    <InputLabel id={labelId}>Release line</InputLabel>
    <Select
      labelId={labelId}
      value={value || ''}
      onChange={e => onChange(e.target.value as string)}
      label="Release line"
      disabled={disabled}
    >
      {releaseLines.map(line => (
        <MenuItem key={line.name} value={line.name}>
          {line.name}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);
