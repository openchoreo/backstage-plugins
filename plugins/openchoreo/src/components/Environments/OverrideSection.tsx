import type { FC } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Button,
  Chip,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import DeleteIcon from '@material-ui/icons/Delete';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { JSONSchema7 } from 'json-schema';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  accordionSummary: {
    '& .MuiAccordionSummary-content': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginRight: theme.spacing(2),
    },
  },
  accordionDetails: {
    flexDirection: 'column',
    padding: theme.spacing(2),
  },
  deleteButton: {
    marginTop: theme.spacing(2),
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  statusChip: {
    fontSize: '0.75rem',
    height: '20px',
  },
}));

interface OverrideSectionProps {
  title: string;
  subtitle?: string;
  schema: JSONSchema7 | null;
  formData: any;
  onChange: (formData: any) => void;
  onDelete: () => void;
  hasInitialData: boolean;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  customContent?: React.ReactNode;
}

export const OverrideSection: FC<OverrideSectionProps> = ({
  title,
  subtitle,
  schema,
  formData,
  onChange,
  onDelete,
  hasInitialData,
  expanded,
  onToggle,
  disabled = false,
  customContent,
}) => {
  const classes = useStyles();

  const hasData = formData && Object.keys(formData).length > 0;

  const handleFormChange = (e: any) => {
    onChange(e.formData);
  };

  return (
    <Accordion expanded={expanded} onChange={onToggle} disabled={disabled}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        className={classes.accordionSummary}
      >
        <Box className={classes.sectionHeader}>
          <Typography variant="subtitle1">
            <strong>{title}</strong>
          </Typography>
          {hasData && (
            <Chip
              label="Configured"
              color="primary"
              size="small"
              className={classes.statusChip}
            />
          )}
        </Box>
        {subtitle && (
          <Typography variant="caption" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </AccordionSummary>
      <AccordionDetails className={classes.accordionDetails}>
        {customContent ? (
          <>
            {customContent}
            <Button
              onClick={onDelete}
              color="secondary"
              startIcon={<DeleteIcon />}
              disabled={!hasInitialData}
              className={classes.deleteButton}
              size="small"
            >
              Delete {title}
            </Button>
          </>
        ) : schema ? (
          <>
            <Form
              schema={schema}
              formData={formData}
              onChange={handleFormChange}
              validator={validator}
              liveValidate={false}
              showErrorList={false}
              noHtml5Validate
            >
              <div />
            </Form>

            <Button
              onClick={onDelete}
              color="secondary"
              startIcon={<DeleteIcon />}
              disabled={!hasInitialData}
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
      </AccordionDetails>
    </Accordion>
  );
};
