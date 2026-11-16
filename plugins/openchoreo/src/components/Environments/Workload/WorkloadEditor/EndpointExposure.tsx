import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { JSONSchema7 } from 'json-schema';
import { RjsfForm } from '@openchoreo/backstage-design-system';
import {
  NO_ENDPOINT,
  endpointProtocol,
  endpointTypeCandidates,
  endpointTypeKey,
  exposableVisibilities,
  parseEndpointTypeKey,
  resolveEndpointType,
  type AllowedEndpointTypeEntry,
  type EndpointExposureChoice,
  type EndpointExposures,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import { generateUiSchemaWithTitles } from '../../../../scaffolder/utils/rjsfUtils';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  select: {
    minWidth: 260,
  },
  note: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
  },
  parameters: {
    marginTop: theme.spacing(1.5),
  },
  parametersHeading: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
}));

export type SchemaState = JSONSchema7 | 'loading' | 'error';

function entryLabel(entry: AllowedEndpointTypeEntry): string {
  return entry.name ? `${entry.ref.name} (${entry.name})` : entry.ref.name;
}

function hasProperties(schema: JSONSchema7): boolean {
  return Object.keys(schema.properties ?? {}).length > 0;
}

/**
 * The EndpointTypes the Endpoints form currently uses: the resolved type of
 * every row with a visibility beyond project that some type can expose.
 */
export function chosenEndpointTypeKeys(
  endpoints: Record<string, ExposableEndpoint>,
  allowedEndpoints: AllowedEndpointTypeEntry[],
  choices: EndpointExposures,
): string[] {
  const keys = new Set<string>();
  for (const [name, endpoint] of Object.entries(endpoints)) {
    if (exposableVisibilities(endpoint).length === 0) continue;
    const type = resolveEndpointType(endpoint, allowedEndpoints, choices[name]);
    if (type !== NO_ENDPOINT) keys.add(type);
  }
  return [...keys].sort();
}

/**
 * Loads the parameters schema of each chosen EndpointType once and keeps it
 * for every endpoint that uses that type.
 */
export function useEndpointTypeSchemas(
  keys: string[],
  namespaceName: string,
): Record<string, SchemaState> {
  const client = useApi(openChoreoClientApiRef);
  const [schemas, setSchemas] = useState<Record<string, SchemaState>>({});
  const missingKey = keys.filter(key => !(key in schemas)).join(',');

  useEffect(() => {
    if (!missingKey) return;
    const missing = missingKey.split(',');
    setSchemas(prev => ({
      ...prev,
      ...Object.fromEntries(missing.map(k => [k, 'loading' as const])),
    }));
    for (const key of missing) {
      const { kind, name } = parseEndpointTypeKey(key);
      client
        .fetchEndpointTypeParametersSchema(kind, name, namespaceName)
        .then(result =>
          setSchemas(prev => ({
            ...prev,
            [key]: (result.data as JSONSchema7) ?? { type: 'object' },
          })),
        )
        .catch(() => setSchemas(prev => ({ ...prev, [key]: 'error' })));
    }
  }, [missingKey, client, namespaceName]);

  return schemas;
}

interface EndpointExposureProps {
  /** The workload endpoint as currently edited. */
  endpoint: ExposableEndpoint;
  allowedEndpoints: AllowedEndpointTypeEntry[];
  choice?: EndpointExposureChoice;
  schemas: Record<string, SchemaState>;
  onChange: (choice: EndpointExposureChoice) => void;
  /** Shown next to the field, e.g. the existing Endpoint and its state. */
  status?: ReactNode;
  /**
   * The row is already exposed through an Endpoint, whose type cannot
   * change: the choice is shown but fixed.
   */
  typeLocked?: boolean;
  /** Shown under the field, e.g. what saving does to this row. */
  notice?: ReactNode;
  disabled?: boolean;
}

/**
 * How one workload endpoint is exposed in the Endpoints form, shown inside
 * its row once it has a visibility beyond project: the Endpoint type, from
 * those allowed for its protocol (the default one preselected), and that
 * type's parameters. The Endpoint carries the row's visibility.
 */
export const EndpointExposure = ({
  endpoint,
  allowedEndpoints,
  choice,
  schemas,
  onChange,
  status,
  typeLocked,
  notice,
  disabled,
}: EndpointExposureProps) => {
  const classes = useStyles();
  const visibilities = exposableVisibilities(endpoint);
  const protocol = endpointProtocol(endpoint);
  const candidates = endpointTypeCandidates(protocol, allowedEndpoints);
  const noticeBox = notice ? (
    <Box className={classes.note}>{notice}</Box>
  ) : null;
  if (visibilities.length === 0) {
    return noticeBox;
  }
  if (candidates.length === 0) {
    // Only reachable from data saved elsewhere: the editor does not offer
    // visibility beyond project for a protocol no type can expose.
    return (
      <Box>
        <Typography className={classes.note}>
          No endpoint type is allowed for {protocol || 'this protocol'}, so{' '}
          {visibilities.join(', ')} visibility stays on the workload
          (deprecated).
        </Typography>
        {noticeBox}
      </Box>
    );
  }

  const type = resolveEndpointType(endpoint, allowedEndpoints, choice);
  const labelOf = (key: string) => {
    const entry = candidates.find(c => endpointTypeKey(c.ref) === key);
    return entry ? entryLabel(entry) : parseEndpointTypeKey(key).name;
  };
  const parameters =
    choice?.type === type ? choice?.parameters ?? {} : ({} as const);

  let body: ReactNode = null;
  const schema = schemas[type];
  if (schema === undefined || schema === 'loading') {
    body = <CircularProgress size={20} />;
  } else if (schema === 'error') {
    body = (
      <Alert severity="warning">
        Could not load the parameters of {parseEndpointTypeKey(type).name}; its
        defaults will be used.
      </Alert>
    );
  } else if (hasProperties(schema)) {
    body = (
      <>
        <Typography className={classes.parametersHeading}>
          Parameters
        </Typography>
        <RjsfForm
          schema={schema}
          uiSchema={generateUiSchemaWithTitles(schema)}
          formData={parameters}
          onChange={(e: any) =>
            onChange({ type, parameters: e.formData ?? {} })
          }
          disabled={disabled}
          tagName="div"
        />
      </>
    );
  }

  return (
    <Box>
      <Box className={classes.row}>
        <TextField
          select
          required
          variant="outlined"
          size="small"
          className={classes.select}
          label="Endpoint type"
          value={type}
          disabled={disabled || typeLocked}
          SelectProps={{ renderValue: value => labelOf(value as string) }}
          helperText={
            typeLocked
              ? "An Endpoint's type is fixed once created. Clear the visibility beyond project to delete it."
              : undefined
          }
          onChange={e => onChange({ type: e.target.value })}
        >
          {candidates.map(entry => (
            <MenuItem
              key={endpointTypeKey(entry.ref)}
              value={endpointTypeKey(entry.ref)}
            >
              {entryLabel(entry)}
            </MenuItem>
          ))}
        </TextField>
        {status}
      </Box>
      {noticeBox && <Box className={classes.parameters}>{noticeBox}</Box>}
      {body && <Box className={classes.parameters}>{body}</Box>}
    </Box>
  );
};
