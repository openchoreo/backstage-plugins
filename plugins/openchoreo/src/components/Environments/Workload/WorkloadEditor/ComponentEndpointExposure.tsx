import { useEffect, type ReactNode } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  NO_ENDPOINT,
  defaultEndpointType,
  endpointProtocol,
  exposableVisibilities,
  type ComponentEndpointSummary,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import { EndpointExposure, type SchemaState } from './EndpointExposure';
import {
  currentEndpointName,
  primaryOriginals,
  rowEndpointType,
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
  title: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
}));

export interface ComponentEndpointExposureProps {
  /** The workload endpoint's name as the card is saved under. */
  workloadEndpoint: string;
  /** The workload endpoint's values, as currently edited. */
  endpoint: ExposableEndpoint;
  state: ComponentEndpointsState;
  schemas: Record<string, SchemaState>;
  disabled: boolean;
  /** Whether the card is open for editing; its Endpoint is read-only otherwise. */
  editing: boolean;
}

/** An existing Endpoint's Ready state, as the card shows it. */
function readiness(original: ComponentEndpointSummary): string {
  if (!original.ready) return 'Pending';
  if (original.ready.status === 'True') return 'Ready';
  return original.ready.reason
    ? `Not ready (${original.ready.reason})`
    : 'Not ready';
}

/**
 * The Endpoint part of an endpoint's card in the Endpoints form. A card with
 * visibility beyond project is exposed through an Endpoint: the one it has,
 * shown with its name, Ready state and (fixed) type, or a new one created on
 * save, whose type defaults to the protocol's default and which isn't
 * labelled until it exists. A project-only card has no Endpoint.
 */
export const ComponentEndpointExposure = ({
  workloadEndpoint,
  endpoint,
  state,
  schemas,
  disabled,
  editing,
}: ComponentEndpointExposureProps) => {
  const classes = useStyles();
  const original = primaryOriginals(state.originals, state.renames).get(
    workloadEndpoint,
  );
  const choice = state.choices[workloadEndpoint];
  const visibilities = exposableVisibilities(endpoint);
  const protocol = endpointProtocol(endpoint);
  const defaultType = defaultEndpointType(protocol, state.allowedEndpoints);

  // Taking visibility beyond project in the card's editor gives it an
  // Endpoint of the protocol's default type, which the editor can change.
  // Recorded as the card's choice, so only cards someone edited plan one.
  const { setChoice } = state;
  const wantsEndpoint =
    editing &&
    !choice &&
    visibilities.length > 0 &&
    defaultType !== NO_ENDPOINT;
  useEffect(() => {
    if (wantsEndpoint) setChoice(workloadEndpoint, { type: defaultType });
  }, [wantsEndpoint, setChoice, workloadEndpoint, defaultType]);

  const exposed =
    visibilities.length > 0 &&
    rowEndpointType(endpoint, state.allowedEndpoints, choice) !== NO_ENDPOINT;
  if (!original && !exposed) return null;

  let notice: ReactNode;
  if (original && !exposed) {
    notice = `Endpoint ${original.name} is deleted on save.`;
  }

  return (
    <Box>
      {original && (
        <Typography className={classes.title}>
          Endpoint {original.name} · {readiness(original)}
        </Typography>
      )}
      <EndpointExposure
        endpoint={endpoint}
        allowedEndpoints={state.allowedEndpoints}
        choice={choice}
        schemas={schemas}
        onChange={next => state.setChoice(workloadEndpoint, next)}
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
    </Box>
  );
};

/**
 * The component's Endpoints that no row shows: those whose workload endpoint
 * was removed (deleted on save) and any further Endpoints of one workload
 * endpoint, which this page leaves as they are.
 */
export const DetachedComponentEndpoints = ({
  workloadEndpoints,
  state,
}: {
  workloadEndpoints: Record<string, ExposableEndpoint>;
  state: ComponentEndpointsState;
}) => {
  const classes = useStyles();
  // Only the Endpoints form lists or changes the component's Endpoints.
  if (state.mode !== 'endpoints') return null;
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
