import { useEffect } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  NO_ENDPOINT,
  defaultEndpointType,
  endpointProtocol,
  endpointVisibilities,
  exposableVisibilities,
  type ComponentEndpointSummary,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import {
  fallbackTypeDescription,
  type EndpointTypeDetails,
} from './EndpointTypePicker';
import {
  EndpointTypeParameters,
  endpointTypeLabel,
  type SchemaState,
} from './EndpointExposure';
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
  typeLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  typeTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    marginTop: theme.spacing(0.25),
  },
  typeDescription: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.25),
  },
  summary: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
  },
  summaryType: {
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
}));

/** An existing Endpoint's Ready state, as the card shows it. */
function readiness(original: ComponentEndpointSummary): string {
  if (!original.ready) return 'Pending';
  if (original.ready.status === 'True') return 'Ready';
  return original.ready.reason
    ? `Not ready (${original.ready.reason})`
    : 'Not ready';
}

/**
 * The Endpoint type a card shows: the one it was added with, or none
 * (project only) without a choice. It decides the protocols the card can
 * take, and whether it can take visibility beyond project.
 */
export function cardEndpointType(
  endpoint: ExposableEndpoint,
  state: ComponentEndpointsState,
  workloadEndpoint: string,
): string {
  return rowEndpointType(
    endpoint,
    state.allowedEndpoints,
    state.choices[workloadEndpoint],
  );
}

/** The Endpoint a card shows, if the card has one on the server. */
function cardOriginal(
  state: ComponentEndpointsState,
  workloadEndpoint: string,
): ComponentEndpointSummary | undefined {
  return primaryOriginals(state.originals, state.renames).get(workloadEndpoint);
}

export interface ComponentEndpointTypeHeaderProps {
  /** The workload endpoint's name as the card is saved under. */
  workloadEndpoint: string;
  /** The workload endpoint's values, as currently edited. */
  endpoint: ExposableEndpoint;
  state: ComponentEndpointsState;
  /** The catalog's title and description per EndpointType key. */
  details: Record<string, EndpointTypeDetails>;
}

/**
 * The top of a card being edited: the Endpoint type it was added with, as a
 * heading with the type's description. The type is picked when the
 * endpoint is added and doesn't change in its form.
 */
export const ComponentEndpointTypeHeader = ({
  workloadEndpoint,
  endpoint,
  state,
  details,
}: ComponentEndpointTypeHeaderProps) => {
  const classes = useStyles();
  const typeKey = cardEndpointType(endpoint, state, workloadEndpoint);
  // A workload endpoint without an Endpoint type has no heading.
  if (typeKey === NO_ENDPOINT) return null;
  const info = details[typeKey];
  return (
    <Box>
      <Typography className={classes.typeLabel}>Endpoint type</Typography>
      <Typography className={classes.typeTitle}>
        {info?.title || endpointTypeLabel(typeKey, state.allowedEndpoints)}
      </Typography>
      <Typography className={classes.typeDescription}>
        {info?.description || fallbackTypeDescription(typeKey)}
      </Typography>
    </Box>
  );
};

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
  /** The catalog's title and description per EndpointType key. */
  details?: Record<string, EndpointTypeDetails>;
}

/** A read-only line of an Endpoint's parameters, e.g. `path: /orders`. */
function parameterSummary(parameters: Record<string, unknown>): string {
  return Object.entries(parameters)
    .filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ');
}

/**
 * The Endpoint part of an endpoint's card in the Endpoints form, under its
 * fields. While editing, the chosen type's parameters; otherwise a summary
 * of how the card is exposed: the Endpoint type, the Endpoint with its
 * Ready state, and the parameters. A project-only card shows nothing,
 * unless its Endpoint is deleted on save.
 */
export const ComponentEndpointExposure = ({
  workloadEndpoint,
  endpoint,
  state,
  schemas,
  disabled,
  editing,
  details,
}: ComponentEndpointExposureProps) => {
  const classes = useStyles();
  const original = cardOriginal(state, workloadEndpoint);
  const choice = state.choices[workloadEndpoint];
  const visibilities = exposableVisibilities(endpoint);
  const protocol = endpointProtocol(endpoint);
  const defaultType = defaultEndpointType(protocol, state.allowedEndpoints);

  // A card that takes visibility beyond project without a type, such as a
  // workload endpoint from before Endpoints, gets the protocol's default
  // type once edited. Recorded as the card's choice, so only cards someone
  // edited plan an Endpoint.
  const { setChoice } = state;
  const wantsEndpoint =
    editing &&
    !choice &&
    visibilities.length > 0 &&
    defaultType !== NO_ENDPOINT;
  useEffect(() => {
    if (wantsEndpoint) setChoice(workloadEndpoint, { type: defaultType });
  }, [wantsEndpoint, setChoice, workloadEndpoint, defaultType]);

  const typeKey = cardEndpointType(endpoint, state, workloadEndpoint);

  if (editing) {
    if (typeKey === NO_ENDPOINT) return null;
    return (
      <EndpointTypeParameters
        typeKey={typeKey}
        parameters={choice?.type === typeKey ? choice.parameters ?? {} : {}}
        schemas={schemas}
        onChange={parameters =>
          state.setChoice(workloadEndpoint, { type: typeKey, parameters })
        }
        disabled={disabled}
      />
    );
  }

  const exposed =
    endpointVisibilities(endpoint).length > 0 && typeKey !== NO_ENDPOINT;
  if (!exposed) {
    return original ? (
      <Typography className={classes.summary}>
        Endpoint {original.name} is deleted on save.
      </Typography>
    ) : null;
  }
  const parameters = parameterSummary(choice?.parameters ?? {});
  return (
    <Typography className={classes.summary}>
      <span className={classes.summaryType}>
        {details?.[typeKey]?.title ||
          endpointTypeLabel(typeKey, state.allowedEndpoints)}
      </span>
      {original && ` · Endpoint ${original.name} · ${readiness(original)}`}
      {parameters && ` · ${parameters}`}
    </Typography>
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
