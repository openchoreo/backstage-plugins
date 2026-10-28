import type { FC } from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@material-ui/core';
import { MAIN_RELEASE_LINE } from '@openchoreo/backstage-plugin-common';

export interface ReleaseLineOption {
  name: string;
}

export interface ReleaseLineSelectProps {
  labelId: string;
  /** The selected line; empty selects the main line. */
  value?: string;
  /** The target's release lines, after its main line. */
  releaseLines: ReleaseLineOption[];
  onChange: (releaseLine: string) => void;
  disabled?: boolean;
}

/**
 * Release line picker for a target component with release lines. The main
 * line comes first and is preselected, as a dependency without a line targets it.
 */
export const ReleaseLineSelect: FC<ReleaseLineSelectProps> = ({
  labelId,
  value,
  releaseLines,
  onChange,
  disabled = false,
}) => (
  <FormControl fullWidth variant="outlined" size="small">
    <InputLabel id={labelId}>Release line</InputLabel>
    <Select
      labelId={labelId}
      value={value || MAIN_RELEASE_LINE}
      onChange={e => onChange(e.target.value as string)}
      label="Release line"
      disabled={disabled}
    >
      <MenuItem value={MAIN_RELEASE_LINE}>{MAIN_RELEASE_LINE}</MenuItem>
      {releaseLines
        .filter(line => line.name !== MAIN_RELEASE_LINE)
        .map(line => (
          <MenuItem key={line.name} value={line.name}>
            {line.name}
          </MenuItem>
        ))}
    </Select>
  </FormControl>
);
