// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { MAIN_RELEASE_LINE } from '@openchoreo/backstage-plugin-common';
import { useReleaseLineSelectStyles } from './styles';

export interface ReleaseLineSelectProps {
  /** The selected line; empty shows every line. */
  value: string;
  /** The release lines on the diagram, besides the main line. */
  lines: string[];
  onChange: (line: string) => void;
}

/** Narrows the cell diagram to every line, the main line, or one release line. */
export function ReleaseLineSelect({
  value,
  lines,
  onChange,
}: ReleaseLineSelectProps) {
  const classes = useReleaseLineSelectStyles();
  return (
    <TextField
      select
      size="small"
      variant="outlined"
      id="cell-diagram-release-line"
      label="Release line"
      className={classes.select}
      value={value}
      onChange={event => onChange(event.target.value)}
      SelectProps={{ displayEmpty: true }}
      InputLabelProps={{ shrink: true }}
    >
      <MenuItem value="">All lines</MenuItem>
      <MenuItem value={MAIN_RELEASE_LINE}>{MAIN_RELEASE_LINE}</MenuItem>
      {lines.map(line => (
        <MenuItem key={line} value={line}>
          {line}
        </MenuItem>
      ))}
    </TextField>
  );
}
