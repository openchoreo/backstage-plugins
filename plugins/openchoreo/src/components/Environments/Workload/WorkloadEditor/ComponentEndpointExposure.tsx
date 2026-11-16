import type { ReactNode } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  NO_ENDPOINT,
  exposableVisibilities,
  resolveEndpointType,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import { EndpointExposure, type SchemaState } from './EndpointExposure';
import {
  currentEndpointName,
  primaryOriginals,
} from '../componentEndpointDrafts';
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';

const useStyles = makeStyles(theme => ({
  heading: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  item: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
  },
}));

export interface ComponentEndpointExposureProps {
  /** The workload endpoint's name as the row is saved under. */
  workloadEndpoint: string;
  /** The workload endpoint's values, as currently edited. */
  endpoint: ExposableEndpoint;
  state: ComponentEndpointsState;
  schemas: Record<string, SchemaState>;
  disabled: boolean;
  /** Whether the row is open for editing; its type and parameters are read-only otherwise. */
  editing: boolean;
}

/**
 * How one workload endpoint is exposed in the Endpoints form, inside its
 * row: the Endpoint type and parameters, with the Endpoint the row is
 * already exposed through. That Endpoint's type is immutable, so the field
 * is fixed for it. A row with visibility beyond project and no Endpoint yet
 * (a new row, or one still carrying the deprecated workload visibility)
 * gets one on save.
 */
export const ComponentEndpointExposure = ({
  workloadEndpoint,
  endpoint,
  state,
  schemas,
  disabled,
  editing,
}: ComponentEndpointExposureProps) => {
  const original = primaryOriginals(state.originals, state.renames).get(
    workloadEndpoint,
  );
  const typeKey = resolveEndpointType(
    endpoint,
    state.allowedEndpoints,
    state.choices[workloadEndpoint],
  );
  const exposed =
    exposableVisibilities(endpoint).length > 0 && typeKey !== NO_ENDPOINT;
  let notice: ReactNode;
  if (original && !exposed) {
    notice = `Endpoint ${original.name} is deleted on save.`;
  } else if (!original && exposed) {
    notice = 'Moves to a new Endpoint on save.';
  }

  return (
    <EndpointExposure
      endpoint={endpoint}
      allowedEndpoints={state.allowedEndpoints}
      choice={state.choices[workloadEndpoint]}
      schemas={schemas}
      onChange={choice => state.setChoice(workloadEndpoint, choice)}
      typeLocked={!!original}
      notice={
        notice && (
          <Typography variant="body2" color="textSecondary">
            {notice}
          </Typography>
        )
      }
      disabled={disabled || !editing}
    />
  );
};

/**
 * The component's Endpoints that no row shows: those whose workload endpoint
 * was removed (deleted on save) and any further Endpoints of one workload
 * endpoint, which this page leaves as they are. In the legacy form, every
 * Endpoint, since saving deletes them all.
 */
export const DetachedComponentEndpoints = ({
  workloadEndpoints,
  state,
}: {
  workloadEndpoints: Record<string, ExposableEndpoint>;
  state: ComponentEndpointsState;
}) => {
  const classes = useStyles();
  if (state.mode === 'legacy') {
    if (state.originals.length === 0) return null;
    return (
      <Box mt={3}>
        <Typography className={classes.heading}>Endpoints</Typography>
        {state.originals.map(original => (
          <Typography key={original.name} className={classes.item}>
            {original.name} ({original.typeName},{' '}
            {original.visibility.join(', ')}) — deleted on save; its visibility
            moves to workload endpoint{' '}
            {currentEndpointName(original, state.renames)}
          </Typography>
        ))}
      </Box>
    );
  }
  const primary = primaryOriginals(state.originals, state.renames);
  const detached = state.originals.filter(original => {
    const name = currentEndpointName(original, state.renames);
    return !workloadEndpoints[name] || primary.get(name) !== original;
  });
  if (detached.length === 0) return null;
  return (
    <Box mt={3}>
      <Typography className={classes.heading}>Other Endpoints</Typography>
      {detached.map(original => {
        const name = currentEndpointName(original, state.renames);
        return (
          <Typography key={original.name} className={classes.item}>
            {original.name} ({original.typeName},{' '}
            {original.visibility.join(', ')}) —{' '}
            {workloadEndpoints[name]
              ? `also exposes ${name}; this page leaves it as it is`
              : `its workload endpoint ${name} was removed, so it is deleted on save`}
          </Typography>
        );
      })}
    </Box>
  );
};
