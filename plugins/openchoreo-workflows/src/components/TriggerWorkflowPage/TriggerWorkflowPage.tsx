import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Content,
  Progress,
  InfoCard,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { Alert, AlertTitle } from '@material-ui/lab';
import {
  Box,
  Button,
  IconButton,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { useWorkflowSchema } from '../../hooks/useWorkflowSchema';
import { useSelectedNamespace } from '../../context';
import { genericWorkflowsClientApiRef } from '../../api';

const useStyles = makeStyles(theme => ({
  backButton: {
    marginBottom: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  header: {
    marginBottom: theme.spacing(3),
  },
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

export const TriggerWorkflowPage = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const { workflowName } = useParams<{ workflowName: string }>();
  const decodedWorkflowName = workflowName
    ? decodeURIComponent(workflowName)
    : '';

  const namespaceName = useSelectedNamespace();
  const client = useApi(genericWorkflowsClientApiRef);
  const { schema, loading, error } = useWorkflowSchema(decodedWorkflowName);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setSubmitError(null);

      const run = await client.createWorkflowRun(
        namespaceName,
        decodedWorkflowName,
        formData,
      );

      // Navigate to the run details page
      navigate(`../runs/${encodeURIComponent(run.name)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate('..');
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
        <Box className={classes.backButton}>
          <IconButton size="small" onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="body2">Back to Workflows</Typography>
        </Box>
        <Alert severity="error">
          <AlertTitle>Error loading workflow schema</AlertTitle>
          {error.message}
        </Alert>
      </Content>
    );
  }

  // Check if schema has properties
  const hasSchema =
    schema &&
    typeof schema === 'object' &&
    'properties' in schema &&
    Object.keys((schema as any).properties || {}).length > 0;

  const uiSchema: UiSchema = {
    'ui:submitButtonOptions': {
      norender: true, // We'll render our own submit button
    },
  };

  return (
    <Content>
      <Box className={classes.backButton}>
        <IconButton size="small" onClick={handleBack}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="body2">Back to Workflows</Typography>
      </Box>

      <InfoCard title={`Trigger: ${decodedWorkflowName}`}>
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
                onClick={handleSubmit}
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
              onClick={handleSubmit}
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
