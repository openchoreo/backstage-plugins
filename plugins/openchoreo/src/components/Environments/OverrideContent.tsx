import type { FC } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { JSONSchema7 } from 'json-schema';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(0),
  },
  deleteButton: {
    marginTop: theme.spacing(2),
  },
}));

interface OverrideContentProps {
  title: string;
  schema: JSONSchema7 | null;
  formData: any;
  onChange: (formData: any) => void;
  onDelete: () => void;
  hasInitialData: boolean;
  disabled?: boolean;
}

export const OverrideContent: FC<OverrideContentProps> = ({
  title,
  schema,
  formData,
  onChange,
  onDelete,
  hasInitialData,
  disabled = false,
}) => {
  const classes = useStyles();

  const handleFormChange = (e: any) => {
    onChange(e.formData);
  };

  return (
    <Box className={classes.container}>
      {schema ? (
        <>
          <Form
            schema={schema}
            formData={formData}
            onChange={handleFormChange}
            validator={validator}
            liveValidate={false}
            showErrorList={false}
            noHtml5Validate
            disabled={disabled}
          >
            <div />
          </Form>

          <Button
            onClick={onDelete}
            color="secondary"
            startIcon={<DeleteIcon />}
            disabled={!hasInitialData || disabled}
            className={classes.deleteButton}
            size="small"
          >
            Delete {title}
          </Button>
        </>
      ) : (
        <Typography variant="body2" color="textSecondary">
          No override schema available for this section.
        </Typography>
      )}
    </Box>
  );
};
