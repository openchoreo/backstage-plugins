import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles } from '@material-ui/core/styles';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import { z } from 'zod';
import { createComponentImplementation } from '@a2ui/react';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import { children, useCardStyles } from './cardStyles';

/**
 * A dry-run's result: the component, passed / failed / doesn't apply, what
 * the rule needs and what the component has. The agent builds it from
 * dry_run_check's own call and result, not from the model's words
 * (dry_run_card_surface in src/agent/a2ui.py). Sections are ReplySections.
 */

export const TestCardApi = {
  name: 'TestCard',
  schema: z.object({
    status: z.enum(['passed', 'failed', 'not-applicable']),
    title: CommonSchemas.DynamicString,
    subtitle: CommonSchemas.DynamicString.optional(),
    summary: CommonSchemas.DynamicString,
    sections: CommonSchemas.ChildList,
  }),
};

const useStyles = makeStyles(theme => ({
  head: { gridTemplateColumns: 'auto minmax(0, 1fr) auto' },
  chip: { fontWeight: 600 },
  headChip: { gridRow: 'span 2' },
  passed: {
    color: theme.palette.success.main,
    backgroundColor: alpha(theme.palette.success.main, 0.14),
    borderColor: alpha(theme.palette.success.main, 0.5),
  },
  failed: {
    color: theme.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.14),
    borderColor: alpha(theme.palette.error.main, 0.5),
  },
  'not-applicable': {
    color: theme.palette.text.secondary,
    backgroundColor: alpha(theme.palette.text.secondary, 0.12),
    borderColor: theme.palette.divider,
  },
}));

const RESULT = {
  passed: { label: 'Passed', Icon: CheckCircleOutlineIcon },
  failed: { label: 'Failed', Icon: HighlightOffIcon },
  'not-applicable': { label: "Doesn't apply", Icon: RemoveCircleOutlineIcon },
};

/** Passed / Failed / Doesn't apply, as the test card shows it. */
export const ResultChip = ({
  status,
  className,
}: {
  status: keyof typeof RESULT;
  className?: string;
}) => {
  const classes = useStyles();
  return (
    <Chip
      size="small"
      variant="outlined"
      label={RESULT[status].label}
      className={`${classes.chip} ${classes[status]} ${className ?? ''}`}
    />
  );
};

export const TestCard = createComponentImplementation(
  TestCardApi,
  ({ props, buildChild }) => {
    const cardClasses = useCardStyles();
    const classes = useStyles();
    const { label, Icon } = RESULT[props.status];
    return (
      <Box
        className={cardClasses.card}
        role="group"
        aria-label={`Test on ${props.title}: ${label}`}
      >
        <Box className={`${cardClasses.head} ${classes.head}`}>
          <span
            className={`${cardClasses.icon} ${classes[props.status]}`}
            aria-hidden="true"
          >
            <Icon />
          </span>
          <Typography variant="body2" className={cardClasses.title}>
            {props.title}
          </Typography>
          <ResultChip status={props.status} className={classes.headChip} />
          {props.subtitle && (
            <Typography variant="caption" className={cardClasses.subtitle}>
              {props.subtitle}
            </Typography>
          )}
        </Box>
        <Typography variant="body1" className={cardClasses.summary}>
          {props.summary}
        </Typography>
        {children(props.sections, buildChild)}
      </Box>
    );
  },
);
