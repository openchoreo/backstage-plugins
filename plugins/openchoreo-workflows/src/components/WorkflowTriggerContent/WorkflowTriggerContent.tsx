import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Content, Progress, InfoCard } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Box, Button, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { IChangeEvent } from '@rjsf/core';
import { useWorkflowSchema } from '../../hooks/useWorkflowSchema';
import { genericWorkflowsClientApiRef } from '../../api';
import { useSelectedNamespace } from '../../context';

const useStyles = makeStyles(theme => ({
  formContainer: {
    marginTop: theme.spacing(2),
  },
  submitButton: {
    marginTop: theme.spacing(3),
  },
  noSchemaMessage: {
    padding: theme.spacing(3),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

/**
 * Entity-aware trigger content component.
 * Must be used within a NamespaceProvider (e.g. wrapped by EntityNamespaceProvider).
 * Gets workflowName from the entity's metadata.name.
 * After triggering, navigates to the runs tab to show run details.
 */
export const WorkflowTriggerContent = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const { entity } = useEntity();

  const workflowName = entity.metadata.name;
  const namespaceName = useSelectedNamespace();
  const client = useApi(genericWorkflowsClientApiRef);
  const { schema, loading, error } = useWorkflowSchema(workflowName);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  const handleSubmit = async (data: IChangeEvent) => {
    try {
      setSubmitting(true);
      setSubmitError(null);

      const run = await client.createWorkflowRun(
        namespaceName,
        workflowName,
        data.formData ?? {},
      );

      // Navigate to the runs tab to view the triggered run
      navigate(`../runs?run=${encodeURIComponent(run.name)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Content>
        <Progress />
      </Content>
    );
  }

  if (error) {
    return (
      <Content>
        <Alert severity="error">
          <AlertTitle>Error loading workflow schema</AlertTitle>
          {error.message}
        </Alert>
      </Content>
    );
  }

  const hasSchema =
    schema &&
    typeof schema === 'object' &&
    'properties' in schema &&
    Object.keys((schema as any).properties || {}).length > 0;

  const uiSchema: UiSchema = {
    'ui:submitButtonOptions': {
      norender: true,
    },
  };

  return (
    <Content>
      <InfoCard title={`Trigger: ${entity.metadata.title || workflowName}`}>
        {submitError && (
          <Alert severity="error" style={{ marginBottom: 16 }}>
            <AlertTitle>Error triggering workflow</AlertTitle>
            {submitError.message}
          </Alert>
        )}

        {hasSchema ? (
          <Box className={classes.formContainer}>
            <Form
              schema={schema as RJSFSchema}
              uiSchema={uiSchema}
              formData={formData}
              validator={validator}
              onChange={e => setFormData(e.formData || {})}
              onSubmit={handleSubmit}
            >
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={submitting}
                className={classes.submitButton}
              >
                {submitting ? 'Triggering...' : 'Trigger Workflow'}
              </Button>
            </Form>
          </Box>
        ) : (
          <Box>
            <Typography className={classes.noSchemaMessage}>
              This workflow has no configurable parameters.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSubmit({ formData: {} } as IChangeEvent)}
              disabled={submitting}
              className={classes.submitButton}
            >
              {submitting ? 'Triggering...' : 'Trigger Workflow'}
            </Button>
          </Box>
        )}
      </InfoCard>
    </Content>
  );
};
