import { useContext, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ChatBubbleOutlineIcon from '@material-ui/icons/ChatBubbleOutline';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import { z } from 'zod';
import { createComponentImplementation } from '@a2ui/react';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import { splitQuestion } from './ChangeCard';
import { children, useCardStyles } from './cardStyles';
import { AgentUiComposerContext, AgentUiInOptions } from './context';

/**
 * A check authoring reply as the card the model filled: a title, a short
 * summary, sections of label / value lines, answers to click and a text
 * box. The model only fills the card's fields; the agent checks them and
 * builds these components (reply_card_surface in src/agent/a2ui.py).
 * Answers are PickRows and the text box an AskField, so a click or a typed
 * answer is sent as the user's next message.
 */

export const ReplyCardApi = {
  name: 'ReplyCard',
  schema: z.object({
    title: CommonSchemas.DynamicString,
    subtitle: CommonSchemas.DynamicString.optional(),
    summary: CommonSchemas.DynamicString,
    sections: CommonSchemas.ChildList,
    // Above the choices; none when not set (no "Pick one").
    choicesLabel: CommonSchemas.DynamicString.optional(),
    choices: CommonSchemas.ChildList,
    answer: CommonSchemas.ChildList,
  }),
};

export const ReplySectionApi = {
  name: 'ReplySection',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    lines: CommonSchemas.ChildList,
  }),
};

export const ReplyLineApi = {
  name: 'ReplyLine',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    value: CommonSchemas.DynamicString,
  }),
};

// Unlike RuleLine (short values like "3 or more"), the model's values can
// be a sentence: every value sits under its label, so a card's lines always
// line up the same way, short or long. Nothing is cut off.
const useStyles = makeStyles(theme => ({
  line: {
    display: 'grid',
    rowGap: theme.spacing(0.25),
  },
  label: {
    color: theme.palette.text.secondary,
    overflowWrap: 'anywhere',
  },
  value: {
    fontWeight: 600,
    color: theme.palette.text.primary,
    overflowWrap: 'anywhere',
  },
  // The question asked after the explanation's sections.
  askAfter: { borderTop: `1px solid ${theme.palette.divider}` },
  last: { borderBottom: 'none' },
}));

export const ReplyCard = createComponentImplementation(
  ReplyCardApi,
  ({ props, buildChild }) => {
    const cardClasses = useCardStyles();
    const classes = useStyles();
    const [statement, question] = splitQuestion(String(props.summary ?? ''));
    const hasChoices = (props.choices?.length ?? 0) > 0;
    const asks = hasChoices || (props.answer?.length ?? 0) > 0;
    // An explanation in sections: its question comes after it, right above
    // the options, so it's read first. Without sections it stays in place.
    const askAfter = !!question && (props.sections?.length ?? 0) > 0;
    const choices = children(props.choices, buildChild);
    // With the drawer's message box, "Tell me something else" is one more
    // row under the choices.
    const composer = useContext(AgentUiComposerContext);
    const answerInChoices = hasChoices && !!composer;
    // The choices sit right under the question, with no "Pick one" above
    // them (2026-11-25), whatever their number.
    const choicesLabel = props.choicesLabel;
    return (
      <Box
        className={cardClasses.card}
        role="group"
        aria-label={String(props.title ?? '')}
      >
        <Box className={cardClasses.head}>
          <span className={cardClasses.icon} aria-hidden="true">
            {asks ? <HelpOutlineIcon /> : <ChatBubbleOutlineIcon />}
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
        {(statement || (question && !askAfter)) && (
          <Typography variant="body1" className={cardClasses.summary}>
            {statement}
            {question && !askAfter && (
              <>
                {' '}
                <span className={cardClasses.question}>{question}</span>
              </>
            )}
          </Typography>
        )}
        {children(props.sections, buildChild)}
        {askAfter && (
          <Typography
            variant="body1"
            className={`${cardClasses.summary} ${classes.askAfter} ${
              asks ? '' : classes.last
            }`}
          >
            <span className={cardClasses.question}>{question}</span>
          </Typography>
        )}
        {hasChoices && (
          <Box
            className={`${cardClasses.section} ${cardClasses.changeSection}`}
          >
            {choicesLabel && (
              <span className={cardClasses.sectionLabel}>{choicesLabel}</span>
            )}
            {choices}
            {answerInChoices && (
              <AgentUiInOptions.Provider value>
                {children(props.answer, buildChild)}
              </AgentUiInOptions.Provider>
            )}
          </Box>
        )}
        {!answerInChoices && children(props.answer, buildChild)}
      </Box>
    );
  },
);

export const ReplySection = createComponentImplementation(
  ReplySectionApi,
  ({ props, buildChild }) => {
    const cardClasses = useCardStyles();
    return (
      <Box className={cardClasses.section}>
        <span className={cardClasses.sectionLabel}>{props.label}</span>
        {children(props.lines, buildChild)}
      </Box>
    );
  },
);

/** A ReplyLine outside A2UI, e.g. in the live progress card. */
export const LineView = ({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) => {
  const classes = useStyles();
  return (
    <Box className={classes.line}>
      {/* A line with no label is just its value, e.g. an area's name. */}
      {label !== '' && label !== null && label !== undefined && (
        <Typography variant="body2" className={classes.label}>
          {label}
        </Typography>
      )}
      <Typography variant="body2" className={classes.value}>
        {value}
      </Typography>
    </Box>
  );
};

export const ReplyLine = createComponentImplementation(
  ReplyLineApi,
  ({ props }) => <LineView label={props.label} value={props.value} />,
);
