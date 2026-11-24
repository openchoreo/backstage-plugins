import { useContext } from 'react';
import Box from '@material-ui/core/Box';
import ButtonBase from '@material-ui/core/ButtonBase';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles } from '@material-ui/core/styles';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import { z } from 'zod';
import { createComponentImplementation } from '@a2ui/react';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import { children, useCardStyles, type ChildRef } from './cardStyles';
import { AgentUiDisabled } from './context';

/**
 * A check authoring reply that drafts no rule — no fact measures what was
 * asked, the entity kind isn't covered, or a value is needed first — as a
 * card: what's wrong in one sentence, then checks to write instead and a
 * question (answered in the message box), or clear answers to click with a
 * box to type your own (an AskField). The agent builds it from the reply
 * (src/agent/reply_view.py); a click or a typed answer is sent as the
 * user's next message.
 */

export const NoticeCardApi = {
  name: 'NoticeCard',
  schema: z.object({
    tone: z.enum(['warn', 'ask']),
    title: CommonSchemas.DynamicString,
    subtitle: CommonSchemas.DynamicString.optional(),
    summary: CommonSchemas.DynamicString,
    picksLabel: CommonSchemas.DynamicString.optional(),
    picks: CommonSchemas.ChildList,
    // Checks the user could write instead: words to read, not to click.
    ideasLabel: CommonSchemas.DynamicString.optional(),
    ideas: z.array(z.string()).optional(),
    // Asked after the ideas; the user answers in the message box.
    question: CommonSchemas.DynamicString.optional(),
    chipsLabel: CommonSchemas.DynamicString.optional(),
    chips: CommonSchemas.ChildList,
    answer: CommonSchemas.ChildList.optional(),
    footer: CommonSchemas.ChildList,
    note: CommonSchemas.DynamicString.optional(),
  }),
};

export const PickRowApi = {
  name: 'PickRow',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    // A second, grey line under the label (the new check intro's level).
    description: CommonSchemas.DynamicString.optional(),
    // What a click sends (also in the action).
    text: z.string().optional(),
    action: CommonSchemas.Action,
  }),
};

export const PickChipApi = {
  name: 'PickChip',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    action: CommonSchemas.Action,
  }),
};

const useStyles = makeStyles(theme => ({
  warn: {
    color: theme.palette.warning.main,
    backgroundColor: alpha(theme.palette.warning.main, 0.14),
  },
  ask: {},
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.25),
    width: '100%',
    textAlign: 'left',
    padding: theme.spacing(0.875, 1.25),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.55)}`,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.text.primary,
    '& svg': { fontSize: 16, color: theme.palette.primary.main },
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '&.Mui-disabled': { opacity: 0.5 },
  },
  rowLabel: { fontWeight: 500 },
  rowText: { display: 'grid', gap: theme.spacing(0.25) },
  rowDescription: { color: theme.palette.text.secondary },
  chips: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) },
  chip: {
    padding: theme.spacing(0.5, 1.5),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.55)}`,
    borderRadius: 999,
    color: theme.palette.text.primary,
    fontWeight: 500,
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '&.Mui-disabled': { opacity: 0.5 },
  },
  note: { color: theme.palette.text.secondary },
  ideas: {
    margin: 0,
    paddingLeft: theme.spacing(2.5),
    display: 'grid',
    gap: theme.spacing(0.5),
  },
  // The question comes after the ideas, like a reply card's.
  question: { borderTop: `1px solid ${theme.palette.divider}` },
  last: { borderBottom: 'none' },
}));

const Section = ({
  label,
  refs,
  buildChild,
  className,
  tinted,
}: {
  label?: string;
  refs?: ChildRef[];
  buildChild: (id: string, basePath?: string) => React.ReactNode;
  className?: string;
  tinted?: boolean;
}) => {
  const cardClasses = useCardStyles();
  if (!refs || refs.length === 0) return null;
  return (
    <Box
      className={`${cardClasses.section} ${
        tinted ? cardClasses.changeSection : ''
      }`}
    >
      {label && <span className={cardClasses.sectionLabel}>{label}</span>}
      <Box className={className}>{children(refs, buildChild)}</Box>
    </Box>
  );
};

export const NoticeCard = createComponentImplementation(
  NoticeCardApi,
  ({ props, buildChild }) => {
    const cardClasses = useCardStyles();
    const classes = useStyles();
    const hasFooter = (props.footer?.length ?? 0) > 0 || !!props.note;
    const ideas = props.ideas ?? [];
    const more =
      hasFooter ||
      (props.chips?.length ?? 0) > 0 ||
      (props.answer?.length ?? 0) > 0;
    return (
      <Box
        className={cardClasses.card}
        role="group"
        aria-label={String(props.title ?? '')}
      >
        <Box className={cardClasses.head}>
          <span
            className={`${cardClasses.icon} ${classes[props.tone]}`}
            aria-hidden="true"
          >
            {props.tone === 'warn' ? (
              <ReportProblemOutlinedIcon />
            ) : (
              <HelpOutlineIcon />
            )}
          </span>
          <Typography variant="body2" className={cardClasses.title}>
            {props.title}
          </Typography>
          {props.subtitle && (
            <Typography variant="caption" className={cardClasses.subtitle}>
              {props.subtitle}
            </Typography>
          )}
        </Box>
        <Typography variant="body1" className={cardClasses.summary}>
          {props.summary}
        </Typography>
        <Section
          label={props.picksLabel}
          refs={props.picks}
          buildChild={buildChild}
          tinted
        />
        {ideas.length > 0 && (
          <Box className={cardClasses.section}>
            {props.ideasLabel && (
              <span className={cardClasses.sectionLabel}>
                {props.ideasLabel}
              </span>
            )}
            <ul className={classes.ideas}>
              {ideas.map(idea => (
                <Typography key={idea} variant="body2" component="li">
                  {idea}
                </Typography>
              ))}
            </ul>
          </Box>
        )}
        {props.question && (
          <Typography
            variant="body1"
            className={`${cardClasses.summary} ${
              ideas.length > 0 ? classes.question : ''
            } ${more ? '' : classes.last}`}
          >
            <span className={cardClasses.question}>{props.question}</span>
          </Typography>
        )}
        <Section
          label={props.chipsLabel}
          refs={props.chips}
          buildChild={buildChild}
          className={classes.chips}
        />
        {children(props.answer, buildChild)}
        {hasFooter && (
          <Box className={cardClasses.footer}>
            {children(props.footer, buildChild)}
            {props.note && (
              <Typography variant="body2" className={classes.note}>
                {props.note}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  },
);

export const PickRow = createComponentImplementation(
  PickRowApi,
  ({ props }) => {
    const classes = useStyles();
    const disabled = useContext(AgentUiDisabled);
    const name = (
      <Typography variant="body2" component="span" className={classes.rowLabel}>
        {props.label}
      </Typography>
    );
    const label = props.description ? (
      <span className={classes.rowText}>
        {name}
        <Typography
          variant="body2"
          component="span"
          className={classes.rowDescription}
        >
          {props.description}
        </Typography>
      </span>
    ) : (
      name
    );
    // A click sends the suggestion at once, as the user's next message.
    return (
      <ButtonBase
        className={classes.row}
        disabled={disabled}
        onClick={() => props.action?.()}
      >
        {label}
        <ArrowForwardIcon aria-hidden="true" />
      </ButtonBase>
    );
  },
);

export const PickChip = createComponentImplementation(
  PickChipApi,
  ({ props }) => {
    const classes = useStyles();
    const disabled = useContext(AgentUiDisabled);
    return (
      <ButtonBase
        className={classes.chip}
        disabled={disabled}
        onClick={() => props.action?.()}
      >
        <Typography variant="body2" component="span">
          {props.label}
        </Typography>
      </ButtonBase>
    );
  },
);
