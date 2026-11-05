// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { makeStyles } from '@material-ui/core/styles';

// From md up a filter bar stays on one row: its cells shrink to fit rather
// than wrap when an optional filter, such as the release line, joins them.
export const useFilterRowStyles = makeStyles(theme => ({
  row: {
    [theme.breakpoints.up('md')]: {
      flexWrap: 'nowrap',
      '& > *': { minWidth: 0 },
    },
  },
}));

export const useReleaseLineFilterStyles = makeStyles(theme => ({
  select: {
    minWidth: theme.spacing(20),
    marginBottom: theme.spacing(2),
  },
}));
