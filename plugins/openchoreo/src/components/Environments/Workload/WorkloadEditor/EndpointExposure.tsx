import { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { JSONSchema7 } from 'json-schema';
import { RjsfForm } from '@openchoreo/backstage-design-system';
import {
  NO_ENDPOINT,
  endpointTypeOptions,
  parseEndpointTypeKey,
  resolveEndpointType,
  type AllowedEndpointTypeEntry,
  type EndpointExposures,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import { generateUiSchemaWithTitles } from '../../../../scaffolder/utils/rjsfUtils';

const useStyles = makeStyles(theme => ({
  parametersHeading: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
}));

export type SchemaState = JSONSchema7 | 'loading' | 'error';

/**
 * How an Endpoint type is named in the form: its EndpointType name, with the
 * allowed entry's name when it has one.
 */
export function endpointTypeLabel(
  typeKey: string,
  allowedEndpoints: AllowedEndpointTypeEntry[],
): string {
  const entry = endpointTypeOptions(allowedEndpoints).find(
    o => o.key === typeKey,
  )?.entry;
  if (!entry) return parseEndpointTypeKey(typeKey).name;
  return entry.name ? `${entry.ref.name} (${entry.name})` : entry.ref.name;
}

function hasProperties(schema: JSONSchema7): boolean {
  return Object.keys(schema.properties ?? {}).length > 0;
}

/**
 * The EndpointTypes the Endpoints form currently uses: the type of every row
 * with an Endpoint, existing or added on the page.
 */
export function chosenEndpointTypeKeys(
  endpoints: Record<string, ExposableEndpoint>,
  allowedEndpoints: AllowedEndpointTypeEntry[],
  choices: EndpointExposures,
): string[] {
  const keys = new Set<string>();
  for (const [name, endpoint] of Object.entries(endpoints)) {
    if (!choices[name]) continue;
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

interface EndpointTypeParametersProps {
  /** The EndpointType key whose parameters are shown. */
  typeKey: string;
  parameters: Record<string, unknown>;
  schemas: Record<string, SchemaState>;
  onChange: (parameters: Record<string, unknown>) => void;
  disabled?: boolean;
}

/**
 * The parameters of a row's Endpoint, from its Endpoint type's schema. A
 * type without parameters shows nothing.
 */
export const EndpointTypeParameters = ({
  typeKey,
  parameters,
  schemas,
  onChange,
  disabled,
}: EndpointTypeParametersProps) => {
  const classes = useStyles();
  const schema = schemas[typeKey];
  if (schema === undefined || schema === 'loading') {
    return <CircularProgress size={20} />;
  }
  if (schema === 'error') {
    return (
      <Alert severity="warning">
        Could not load the parameters of {parseEndpointTypeKey(typeKey).name};
        its defaults will be used.
      </Alert>
    );
  }
  if (!hasProperties(schema)) return null;
  return (
    <Box>
      <Typography className={classes.parametersHeading}>Parameters</Typography>
      <RjsfForm
        schema={schema}
        uiSchema={generateUiSchemaWithTitles(schema)}
        formData={parameters}
        onChange={(e: any) => onChange(e.formData ?? {})}
        disabled={disabled}
        tagName="div"
      />
    </Box>
  );
};
