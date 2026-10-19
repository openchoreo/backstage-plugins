import { useEffect, useRef } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
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
  editor: {
    fontFamily: 'monospace',
    fontSize: theme.typography.body2.fontSize,
  },
}));

/**
 * Sets the API schema the Endpoint publishes. Pre-fills it from the first
 * backend's workload endpoint schema and keeps following that backend until
 * the user edits the content. The catalog creates an API entity from it.
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
  // The checkbox starts on, and stays as the user leaves it.
  const enabledRef = useRef(value.content !== undefined || !formData);
  const userEditedRef = useRef(
    value.content !== undefined && value.copiedFrom === undefined,
  );

  // Follow the first backend's schema until the user edits the content.
  useEffect(() => {
    if (!enabledRef.current || userEditedRef.current) return;
    if (!source?.schemaContent) {
      if (value.copiedFrom) onChange({});
      return;
    }
    if (value.copiedFrom !== sourceKey) {
      onChange({
        type: source.schemaType,
        content: source.schemaContent,
        copiedFrom: sourceKey,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, source?.schemaContent]);

  const enabled = enabledRef.current;

  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            color="primary"
            checked={enabled}
            onChange={e => {
              enabledRef.current = e.target.checked;
              userEditedRef.current = false;
              onChange(
                e.target.checked && source?.schemaContent
                  ? {
                      type: source.schemaType,
                      content: source.schemaContent,
                      copiedFrom: sourceKey,
                    }
                  : {},
              );
            }}
          />
        }
        label="Publish an API schema for this endpoint"
      />
      {enabled && (
        <>
          <Typography variant="body2" className={classes.hint}>
            {value.copiedFrom
              ? `Copied from ${value.copiedFrom}. Edit it to override.`
              : 'The first backend has no schema to copy. Paste one to publish it.'}
          </Typography>
          <TextField
            label={value.type ? `Schema (${value.type})` : 'Schema'}
            variant="outlined"
            multiline
            fullWidth
            minRows={6}
            maxRows={20}
            InputProps={{ className: classes.editor }}
            value={value.content ?? ''}
            onChange={e => {
              userEditedRef.current = true;
              onChange({ type: value.type, content: e.target.value });
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
