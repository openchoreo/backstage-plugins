// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { MAIN_RELEASE_LINE } from '@openchoreo/backstage-plugin-common';
import { useReleaseLine } from '@openchoreo/backstage-plugin-react';
import { useComponentReleaseLineState } from '../../hooks/useComponentReleaseLines';
import {
  ALL_RELEASE_LINES,
  useReleaseLineParam,
} from '../../hooks/useSelectedReleaseLine';
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
  /** True while the given `lines` are still loading, so a URL line is kept. */
  linesLoading?: boolean;
  disabled?: boolean;
  /**
   * Line shown while the URL names none, the one the view's data falls back
   * to, such as `componentDefaultReleaseLine`. Every line when absent.
   */
  defaultLine?: string;
  /** Render as a cell of a filter bar's grid instead of a row of its own. */
  gridItem?: boolean;
  size?: 'small' | 'medium';
  /** Class of the select when it is not a grid item. */
  className?: string;
}

/**
 * Release line filter of an observability view: every line, the main line, or one
 * release line of the component. Shown only for a component with release
 * lines, and not on a ReleaseLine page, which is scoped to its own line. The
 * choice lives in the URL, where `useSelectedReleaseLine` reads it.
 */
export function ReleaseLineFilter({
  namespace,
  component,
  lines: givenLines,
  linesLoading,
  disabled,
  defaultLine = ALL_RELEASE_LINES,
  gridItem,
  size,
  className,
}: ReleaseLineFilterProps) {
  const classes = useReleaseLineFilterStyles();
  const { releaseLine: pageLine } = useReleaseLine();
  const componentLines = useComponentReleaseLineState(
    namespace,
    givenLines ? undefined : component,
  );
  const lines = givenLines ?? componentLines.lines;
  const loading = givenLines ? Boolean(linesLoading) : componentLines.loading;
  const scoped = Boolean(givenLines || component);
  const [value, setValue] = useReleaseLineParam();

  const offered = !pageLine && scoped && lines.length > 0;
  const stale =
    Boolean(value) &&
    (!scoped ||
      (!loading &&
        (lines.length === 0 ||
          (value !== MAIN_RELEASE_LINE &&
            value !== ALL_RELEASE_LINES &&
            !lines.includes(value)))));

  // A line left over from another component no longer applies.
  useEffect(() => {
    if (!pageLine && stale) setValue('');
  }, [pageLine, stale, setValue]);

  if (!offered) return null;

  const select = (
    <TextField
      select
      fullWidth={gridItem}
      variant="outlined"
      id="observability-release-line"
      label="Release Line"
      size={size}
      className={gridItem ? undefined : className ?? classes.select}
      value={stale || !value ? defaultLine : value}
      onChange={event =>
        setValue(event.target.value === defaultLine ? '' : event.target.value)
      }
      InputLabelProps={{ shrink: true }}
      disabled={disabled}
    >
      <MenuItem value={ALL_RELEASE_LINES}>All lines</MenuItem>
      <MenuItem value={MAIN_RELEASE_LINE}>{MAIN_RELEASE_LINE}</MenuItem>
      {lines.map(line => (
        <MenuItem key={line} value={line}>
          {line}
        </MenuItem>
      ))}
    </TextField>
  );

  if (!gridItem) return select;

  return (
    <Grid item xs={12} md={2}>
      {select}
    </Grid>
  );
}
