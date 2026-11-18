import { useEffect } from 'react';
import {
  Box,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import {
  StatusBadge,
  type StatusType,
} from '@openchoreo/backstage-design-system';
import { makeStyles } from '@material-ui/core/styles';
import {
  NO_ENDPOINT,
  defaultEndpointType,
  endpointProtocol,
  endpointTypeKey,
  endpointTypeOptions,
  exposableVisibilities,
  protocolForEndpointType,
  type ComponentEndpointSummary,
  type ExposableEndpoint,
  type WorkloadEndpoint,
} from '@openchoreo/backstage-plugin-common';
import { endpointProtocolChanges } from '@openchoreo/backstage-plugin-react';
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
  typeRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  typeField: {
    minWidth: 280,
  },
  endpointName: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
  },
  info: {
    fontSize: 18,
    color: theme.palette.text.secondary,
  },
  deleteNotice: {
    fontSize: '0.8125rem',
    color: theme.palette.warning.dark,
    marginTop: theme.spacing(0.75),
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

/** An existing Endpoint's Ready state, as a status badge. */
function readinessStatus(original: ComponentEndpointSummary): StatusType {
  if (!original.ready) return 'pending';
  return original.ready.status === 'True' ? 'success' : 'error';
}

const LOCKED_TYPE_HELP =
  "An Endpoint's type is fixed once created. Choose Project only to delete it.";

/** What the "Exposed as" field shows for a card without an Endpoint type. */
export const PROJECT_ONLY_LABEL = 'Project only (no Endpoint)';

/**
 * The Endpoint type a card shows: the one chosen for it, or none (project
 * only) without a choice. It decides the protocols the card can take, and
 * whether it can take visibility beyond project.
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

function originalTypeKey(original: ComponentEndpointSummary): string {
  return endpointTypeKey({ kind: original.typeKind, name: original.typeName });
}

export interface ComponentEndpointTypeFieldProps {
  /** The workload endpoint's name as the card is saved under. */
  workloadEndpoint: string;
  /** The workload endpoint's values, as currently edited. */
  endpoint: WorkloadEndpoint;
  state: ComponentEndpointsState;
  /** Changes a field of the card's workload endpoint. */
  onEndpointChange: (field: keyof WorkloadEndpoint, value: unknown) => void;
  disabled: boolean;
}

/**
 * The first field of a card being edited: how the endpoint is exposed,
 * either within the project only or through an Endpoint of an allowed type.
 * Picking a type limits the card's protocols to those the type serves. An
 * existing Endpoint's type is fixed; choosing "Project only" deletes the
 * Endpoint on save.
 */
export const ComponentEndpointTypeField = ({
  workloadEndpoint,
  endpoint,
  state,
  onEndpointChange,
  disabled,
}: ComponentEndpointTypeFieldProps) => {
  const classes = useStyles();
  const original = cardOriginal(state, workloadEndpoint);
  const lockedType = original ? originalTypeKey(original) : undefined;
  const choice = state.choices[workloadEndpoint];
  const value = cardEndpointType(endpoint, state, workloadEndpoint);
  const options = endpointTypeOptions(state.allowedEndpoints);

  const select = (typeKey: string) => {
    if (typeKey === NO_ENDPOINT) {
      state.restoreChoice(workloadEndpoint, undefined);
      onEndpointChange(
        'visibility',
        (endpoint.visibility ?? []).filter(v => v === 'project'),
      );
      return;
    }
    // Back to the Endpoint the card has: its parameters and visibility.
    const backToOriginal = !!original && typeKey === lockedType;
    let parameters: Record<string, unknown> = {};
    if (backToOriginal) parameters = original.parameters ?? {};
    else if (choice?.type === typeKey) parameters = choice.parameters ?? {};
    state.setChoice(workloadEndpoint, { type: typeKey, parameters });

    const protocol = endpointProtocol(endpoint);
    const next = protocolForEndpointType(
      protocol,
      typeKey,
      state.allowedEndpoints,
    );
    if (next !== protocol) {
      for (const [field, change] of endpointProtocolChanges(endpoint, next)) {
        onEndpointChange(field, change);
      }
    }
    if (backToOriginal && exposableVisibilities(endpoint).length === 0) {
      onEndpointChange('visibility', [
        ...new Set([...(endpoint.visibility ?? []), ...original.visibility]),
      ]);
    }
  };

  const deleted = !!original && value === NO_ENDPOINT;

  return (
    <Box>
      <Box className={classes.typeRow}>
        <TextField
          select
          variant="outlined"
          size="small"
          label="Exposed as"
          // Labels the select for assistive technology.
          id={`exposed-as-${workloadEndpoint}`}
          className={classes.typeField}
          value={value}
          disabled={disabled}
          onChange={e => select(e.target.value)}
        >
          <MenuItem value={NO_ENDPOINT}>{PROJECT_ONLY_LABEL}</MenuItem>
          {options.map(option => (
            <MenuItem
              key={option.key}
              value={option.key}
              disabled={!!lockedType && option.key !== lockedType}
            >
              {endpointTypeLabel(option.key, state.allowedEndpoints)}
              {' · '}
              {option.protocols.join(', ')}
            </MenuItem>
          ))}
          {/* An Endpoint whose type is no longer allowed keeps showing it. */}
          {lockedType && !options.some(o => o.key === lockedType) && (
            <MenuItem value={lockedType}>
              {endpointTypeLabel(lockedType, state.allowedEndpoints)}
            </MenuItem>
          )}
        </TextField>
        {original && !deleted && (
          <>
            <StatusBadge
              status={readinessStatus(original)}
              label={readiness(original)}
            />
            <Typography className={classes.endpointName}>
              Endpoint {original.name}
            </Typography>
          </>
        )}
        {lockedType && (
          <Tooltip title={LOCKED_TYPE_HELP}>
            <InfoOutlinedIcon
              className={classes.info}
              aria-label={LOCKED_TYPE_HELP}
            />
          </Tooltip>
        )}
      </Box>
      {deleted && original && (
        <Typography className={classes.deleteNotice}>
          Endpoint {original.name} is deleted on save.
        </Typography>
      )}
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

  const exposed = visibilities.length > 0 && typeKey !== NO_ENDPOINT;
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
      Exposed as{' '}
      <span className={classes.summaryType}>
        {endpointTypeLabel(typeKey, state.allowedEndpoints)}
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
