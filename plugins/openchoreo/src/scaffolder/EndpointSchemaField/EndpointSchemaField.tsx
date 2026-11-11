import { useEffect, useRef } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  readProjectNamespace,
  useProjectWorkloadEndpoints,
} from '../EndpointBackendsField/useProjectWorkloadEndpoints';
import type { EndpointBackendValue } from '../EndpointBackendsField/EndpointBackendsField';

/** The schema value: empty when the Endpoint publishes no API schema. */
export interface EndpointSchemaValue {
  type?: string;
  content?: string;
  /** `component/endpoint` the content was copied from, until edited. */
  copiedFrom?: string;
}

const useStyles = makeStyles(theme => ({
  hint: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  type: {
    minWidth: 160,
    marginBottom: theme.spacing(1),
  },
  editor: {
    fontFamily: 'monospace',
    fontSize: theme.typography.body2.fontSize,
  },
}));

/** Schema formats offered for a pasted schema. */
const SCHEMA_TYPES = ['openapi', 'graphql', 'grpc', 'asyncapi'];
const DEFAULT_SCHEMA_TYPE = 'openapi';

/**
 * Optionally sets the API schema the Endpoint publishes. Off by default, so
 * a copy of the backend's schema isn't frozen into every new Endpoint, where
 * it would go stale on the backend's next build. Turned on, it starts from
 * the first backend's schema and follows that backend until the user edits
 * it, and the catalog creates an API entity from it.
 *
 * The value is `{}` while off. While on, `content` is always set (possibly
 * empty), so the checkbox is restored as it was when the step is revisited.
 * `copiedFrom` names the backend the content was copied from, until edited.
 */
export const EndpointSchemaField = ({
  formData,
  onChange,
  formContext,
  uiSchema,
}: FieldExtensionComponentProps<EndpointSchemaValue>) => {
  const classes = useStyles();
  const options = uiSchema?.['ui:options'] ?? {};
  const { project, namespace } = readProjectNamespace(
    formContext?.formData,
    (options.projectNamespaceField as string) ?? 'project_namespace',
  );
  const backends = (formContext?.formData?.[
    (options.backendsField as string) ?? 'backends'
  ] ?? []) as EndpointBackendValue[];
  const first = backends.find(b => b.component && b.endpoint);
  const { options: endpoints } = useProjectWorkloadEndpoints(
    namespace,
    project,
  );
  const source = first
    ? endpoints.find(
        o => o.component === first.component && o.endpoint === first.endpoint,
      )
    : undefined;
  const sourceKey = source ? `${source.component}/${source.endpoint}` : '';

  const value = formData ?? {};
  const enabled = value.content !== undefined;
  // Edited content no longer follows the first backend. Empty content (on,
  // nothing to copy yet) still picks up a schema once there is one.
  const userEditedRef = useRef(
    !!value.content && value.copiedFrom === undefined,
  );

  const copyFromSource = (): EndpointSchemaValue =>
    source?.schemaContent
      ? {
          type: source.schemaType || DEFAULT_SCHEMA_TYPE,
          content: source.schemaContent,
          copiedFrom: sourceKey,
        }
      : { type: value.type || DEFAULT_SCHEMA_TYPE, content: '' };

  // While on, follow the first backend's schema until the user edits it.
  useEffect(() => {
    if (!enabled || userEditedRef.current) return;
    if (!source?.schemaContent) {
      if (value.copiedFrom) onChange(copyFromSource());
      return;
    }
    if (value.copiedFrom !== sourceKey) onChange(copyFromSource());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sourceKey, source?.schemaContent]);

  // Editing drops `copiedFrom`, which is how a remount tells an edited schema
  // from a copied one; so the hint reads the state rather than keeping it.
  let hint: string;
  if (value.copiedFrom) {
    hint = `Copied from ${value.copiedFrom}. Edit it to override.`;
  } else if (value.content) {
    hint = "Edited. It no longer follows the first backend's schema.";
  } else if (source?.schemaContent) {
    hint = 'Paste a schema to publish it.';
  } else {
    hint = 'The first backend has no schema to copy. Paste one to publish it.';
  }

  const type = value.type || DEFAULT_SCHEMA_TYPE;
  const typeOptions = SCHEMA_TYPES.includes(type)
    ? SCHEMA_TYPES
    : [type, ...SCHEMA_TYPES];

  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            color="primary"
            checked={enabled}
            onChange={e => {
              userEditedRef.current = false;
              onChange(e.target.checked ? copyFromSource() : {});
            }}
          />
        }
        label="Override the API schema"
      />
      <Typography variant="body2" className={classes.hint}>
        {enabled
          ? hint
          : 'Without an override, the Endpoint carries no schema of its own, and the catalog lists no API for it.'}
      </Typography>
      {enabled && (
        <>
          <TextField
            select
            label="Schema type"
            variant="outlined"
            size="small"
            className={classes.type}
            value={type}
            onChange={e => {
              userEditedRef.current = true;
              onChange({ type: e.target.value, content: value.content ?? '' });
            }}
          >
            {typeOptions.map(t => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Schema"
            variant="outlined"
            multiline
            fullWidth
            minRows={6}
            maxRows={20}
            InputProps={{ className: classes.editor }}
            value={value.content ?? ''}
            onChange={e => {
              userEditedRef.current = true;
              onChange({ type, content: e.target.value });
            }}
          />
        </>
      )}
    </Box>
  );
};

export const EndpointSchemaFieldSchema = {
  returnValue: {
    type: 'object' as const,
    properties: {
      type: { type: 'string' as const },
      content: { type: 'string' as const },
    },
  },
};
