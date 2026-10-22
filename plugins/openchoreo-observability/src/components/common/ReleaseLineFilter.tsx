// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { DEFAULT_RELEASE_LINE } from '@openchoreo/backstage-plugin-common';
import { useReleaseLine } from '@openchoreo/backstage-plugin-react';
import { useComponentReleaseLineState } from '../../hooks/useComponentReleaseLines';
import { useReleaseLineParam } from '../../hooks/useSelectedReleaseLine';
import { useReleaseLineFilterStyles } from './styles';

export interface ReleaseLineFilterProps {
  namespace?: string;
  /** The component whose lines to offer; without one there is no filter. */
  component?: string;
  /**
   * Release lines to offer instead of the component's, for a view that lists
   * several components, such as cost reports filtered by their line.
   */
  lines?: string[];
  disabled?: boolean;
}

/**
 * Release line filter of an observability view: every line, the default line, or one
 * release line of the component. Shown only for a component with release
 * lines, and not on a ReleaseLine page, which is scoped to its own line. The
 * choice lives in the URL, where `useSelectedReleaseLine` reads it.
 */
export function ReleaseLineFilter({
  namespace,
  component,
  lines: givenLines,
  disabled,
}: ReleaseLineFilterProps) {
  const classes = useReleaseLineFilterStyles();
  const { releaseLine: pageLine } = useReleaseLine();
  const componentLines = useComponentReleaseLineState(
    namespace,
    givenLines ? undefined : component,
  );
  const lines = givenLines ?? componentLines.lines;
  const loading = !givenLines && componentLines.loading;
  const scoped = Boolean(givenLines || component);
  const [value, setValue] = useReleaseLineParam();

  const offered = !pageLine && scoped && lines.length > 0;
  const stale =
    Boolean(value) &&
    (!scoped ||
      (!loading &&
        (lines.length === 0 ||
          (value !== DEFAULT_RELEASE_LINE && !lines.includes(value)))));

  // A line left over from another component no longer applies.
  useEffect(() => {
    if (!pageLine && stale) setValue('');
  }, [pageLine, stale, setValue]);

  if (!offered) return null;

  return (
    <TextField
      select
      size="small"
      variant="outlined"
      id="observability-release-line"
      label="Release line"
      className={classes.select}
      value={stale ? '' : value}
      onChange={event => setValue(event.target.value)}
      SelectProps={{ displayEmpty: true }}
      InputLabelProps={{ shrink: true }}
      disabled={disabled}
    >
      <MenuItem value="">All lines</MenuItem>
      <MenuItem value={DEFAULT_RELEASE_LINE}>{DEFAULT_RELEASE_LINE}</MenuItem>
      {lines.map(line => (
        <MenuItem key={line} value={line}>
          {line}
        </MenuItem>
      ))}
    </TextField>
  );
}
