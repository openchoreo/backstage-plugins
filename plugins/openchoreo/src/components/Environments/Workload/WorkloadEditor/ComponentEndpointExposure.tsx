import type { ReactNode } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import {
  NO_ENDPOINT,
  defaultEndpointType,
  endpointProtocol,
  endpointTypeCandidates,
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  title: {
    fontSize: '0.8125rem',
    fontWeight: 600,
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
  /** Whether the row is open for editing; its Endpoint is read-only otherwise. */
  editing: boolean;
}

/** An existing Endpoint's Ready state, as the row's header shows it. */
function readiness(original: ComponentEndpointSummary): string {
  if (!original.ready) return 'Pending';
  if (original.ready.status === 'True') return 'Ready';
  return original.ready.reason
    ? `Not ready (${original.ready.reason})`
    : 'Not ready';
}

/**
 * How one workload endpoint is exposed in the Endpoints form, inside its
 * row. A row has an Endpoint only once one exists or is added for it:
 * - an existing Endpoint shows its name and Ready state, with its type
 *   (fixed) and parameters;
 * - an Endpoint added on the page, or drafted from the main line on a
 *   release line, is created on save, and can be removed before then;
 * - a row without one offers to add one. Visibility beyond project that the
 *   workload still carries stays there (deprecated) until an Endpoint is
 *   added, which moves it onto the Endpoint.
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
  const canAdd =
    editing &&
    !disabled &&
    endpointTypeCandidates(protocol, state.allowedEndpoints).length > 0;

  if (!original && !choice) {
    return (
      <Box className={classes.header}>
        <Typography variant="body2" color="textSecondary">
          {visibilities.length > 0
            ? `No Endpoint. Its ${visibilities.join(
                ', ',
              )} visibility is on the workload (deprecated); add an Endpoint to expose it through one.`
            : 'No Endpoint: reachable within the project only.'}
        </Typography>
        {canAdd && (
          <Button
            size="small"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() =>
              state.setChoice(workloadEndpoint, {
                type: defaultEndpointType(protocol, state.allowedEndpoints),
              })
            }
          >
            Add Endpoint
          </Button>
        )}
      </Box>
    );
  }

  const exposed =
    visibilities.length > 0 &&
    rowEndpointType(endpoint, state.allowedEndpoints, choice) !== NO_ENDPOINT;
  let notice: ReactNode;
  if (original && !exposed) {
    notice = `Endpoint ${original.name} is deleted on save.`;
  } else if (!original && !exposed) {
    notice =
      'Select a visibility beyond project for it; without one, no Endpoint is created.';
  }

  return (
    <Box>
      <Box className={classes.header}>
        <Typography className={classes.title}>
          {original
            ? `Endpoint ${original.name} · ${readiness(original)}`
            : 'New Endpoint · created on save'}
        </Typography>
        {!original && editing && !disabled && (
          <Button
            size="small"
            onClick={() => state.restoreChoice(workloadEndpoint, undefined)}
          >
            Remove
          </Button>
        )}
      </Box>
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
  // A legacy ComponentType's components own no Endpoints, and the legacy
  // form never changes them.
  if (state.mode === 'legacy') return null;
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
