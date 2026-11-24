import { useContext } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { z } from 'zod';
import { createBinderlessComponentImplementation } from '@a2ui/react';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import {
  children,
  useButtonStyles,
  useCardStyles,
  type ChildRef,
} from './cardStyles';
import { AgentUiDisabled, AgentUiOpenCheck, type OpenedCheck } from './context';

/**
 * A drafted new check like one that is saved already, shown instead of its
 * save card: the check found, why editing it is recommended, its rule (and
 * the new one when they differ) in plain words, and two buttons. The first
 * moves the chat to that check, as after a save, and sends `editMessage`
 * when there is one (AgentUiOpenCheck); "Create a separate check" is sent
 * as the user's next message and gets the draft's save card. Nothing is
 * saved from this card. The agent builds it (src/agent/existing_check.py).
 */
export const ExistingCheckCardApi = {
  name: 'ExistingCheckCard',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    summary: z.string(),
    question: z.string().optional(),
    ruleLabel: z.string().optional(),
    rule: CommonSchemas.ChildList,
    // The user's new rule, when it differs from the check's.
    draft: CommonSchemas.ChildList.optional(),
    editLabel: z.string(),
    editMessage: z.string().optional(),
    nextStep: z.string().optional(),
    check: z.object({
      checkId: z.string(),
      name: z.string(),
      description: z.string().optional(),
      rule: z.string(),
      factIds: z.array(z.string()).optional(),
      status: z.enum(['draft', 'published']),
    }),
    footer: CommonSchemas.ChildList,
  }),
};

type ExistingCheckCardProps = {
  title: string;
  subtitle?: string;
  summary: string;
  question?: string;
  ruleLabel?: string;
  rule?: ChildRef[];
  draft?: ChildRef[];
  editLabel: string;
  editMessage?: string;
  nextStep?: string;
  check: OpenedCheck;
  footer?: ChildRef[];
};

const useStyles = makeStyles(theme => ({
  next: { flexBasis: '100%', color: theme.palette.text.secondary },
}));

// Binderless: the check reaches the drawer exactly as the agent sent it.
export const ExistingCheckCard = createBinderlessComponentImplementation(
  ExistingCheckCardApi,
  ({ context, buildChild }) => {
    const classes = useCardStyles();
    const buttons = useButtonStyles();
    const own = useStyles();
    const disabled = useContext(AgentUiDisabled);
    const openCheck = useContext(AgentUiOpenCheck);
    const props = context.componentModel
      .properties as unknown as ExistingCheckCardProps;
    const section = (label: string, refs: ChildRef[] | undefined, extra = '') =>
      refs && refs.length > 0 ? (
        <Box className={`${classes.section} ${extra}`}>
          <span className={classes.sectionLabel}>{label}</span>
          {children(refs, buildChild)}
        </Box>
      ) : null;
    return (
      <Box className={classes.card} role="group" aria-label={props.title}>
        <Box className={classes.head}>
          <span className={classes.icon} aria-hidden="true">
            <FileCopyOutlinedIcon />
          </span>
          <Typography variant="body2" className={classes.title}>
            {props.title}
          </Typography>
          {props.subtitle && (
            <Typography variant="caption" className={classes.subtitle}>
              {props.subtitle}
            </Typography>
          )}
        </Box>
        <Typography variant="body1" className={classes.summary}>
          {props.summary}
        </Typography>
        {section(props.ruleLabel ?? 'What it checks', props.rule)}
        {section('Your new rule', props.draft, classes.changeSection)}
        {props.question && (
          <Typography
            variant="body1"
            className={`${classes.summary} ${classes.askBelow}`}
          >
            <span className={classes.question}>{props.question}</span>
          </Typography>
        )}
        <Box className={classes.footer}>
          {openCheck && (
            <Button
              size="small"
              variant="contained"
              className={`${buttons.button} ${buttons.primary}`}
              disabled={disabled}
              onClick={() => openCheck(props.check, props.editMessage)}
            >
              {props.editLabel}
            </Button>
          )}
          {children(props.footer, buildChild)}
          {props.nextStep && (
            <Typography variant="body2" className={own.next}>
              {props.nextStep}
            </Typography>
          )}
        </Box>
      </Box>
    );
  },
);
