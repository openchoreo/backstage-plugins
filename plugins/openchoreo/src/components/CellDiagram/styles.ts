// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { makeStyles } from '@material-ui/core/styles';

export const useReleaseLineSelectStyles = makeStyles(theme => ({
  select: {
    minWidth: theme.spacing(20),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
  },
}));
