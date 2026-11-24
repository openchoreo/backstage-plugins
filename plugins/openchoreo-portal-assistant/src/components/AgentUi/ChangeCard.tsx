import { useContext, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import ButtonBase from '@material-ui/core/ButtonBase';
import Typography from '@material-ui/core/Typography';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import { z } from 'zod';
import { createComponentImplementation } from '@a2ui/react';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import { children, useCardStyles, type ChildRef } from './cardStyles';
import { AgentUiDisabled } from './context';

/**
 * The card a check edit question is shown as: the agent's sentence, the
 * rule as it is now, and only the conditions that change, in plain words,
 * with the answer buttons. The agent builds it from the exact rules
 * (src/agent/rule_view.py); a click only sends "yes", a choice number or
 * "no" as the next message. Numbered choices also get a box to type your
 * own answer (an AskField) under them; Yes / No doesn't.
 */

export const ChangeCardApi = {
  name: 'ChangeCard',
  schema: z.object({
    title: CommonSchemas.DynamicString,
    subtitle: CommonSchemas.DynamicString.optional(),
    summary: CommonSchemas.DynamicString.optional(),
    current: CommonSchemas.ChildList,
    changes: CommonSchemas.ChildList,
    footer: CommonSchemas.ChildList,
    answer: CommonSchemas.ChildList.optional(),
  }),
};

export const RuleLineApi = {
  name: 'RuleLine',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    value: CommonSchemas.DynamicString,
    // A test result's line: whether the value follows the rule, and what
    // the rule wants when it doesn't.
    mark: z.enum(['pass', 'fail']).optional(),
    hint: CommonSchemas.DynamicString.optional(),
  }),
};

export const ChangeRowApi = {
  name: 'ChangeRow',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    state: z.enum(['changed', 'added', 'removed', 'pick']),
    before: CommonSchemas.DynamicString.optional(),
    after: CommonSchemas.DynamicString.optional(),
  }),
};

export const OptionTileApi = {
  name: 'OptionTile',
  schema: z.object({
    badge: CommonSchemas.DynamicString,
    value: CommonSchemas.DynamicString,
    action: CommonSchemas.Action,
  }),
};

/**
 * The summary with its closing question, if any, set apart: the last
 * sentence ending in "?", with a short line after it ("Tell me below."), or
 * the whole summary when it is only a question.
 */
export const splitQuestion = (summary: string): [string, string] => {
  const text = summary.trim();
  const end = text.lastIndexOf('?');
  if (end < 0 || text.length - end > 60) return [summary, ''];
  const before = text.slice(0, end);
  const start = Math.max(
    before.lastIndexOf('. '),
    before.lastIndexOf('! '),
    before.lastIndexOf('? '),
    before.lastIndexOf('.\n'),
  );
  const statement = start < 0 ? '' : text.slice(0, start + 1);
  return [statement, text.slice(start < 0 ? 0 : start + 2)];
};

export const ChangeCard = createComponentImplementation(
  ChangeCardApi,
  ({ props, buildChild }) => {
    const classes = useCardStyles();
    const [statement, question] = splitQuestion(String(props.summary ?? ''));
    const section = (label: string, refs: ChildRef[] | undefined, extra = '') =>
      refs && refs.length > 0 ? (
        <Box className={`${classes.section} ${extra}`}>
          <span className={classes.sectionLabel}>{label}</span>
          {children(refs, buildChild)}
        </Box>
      ) : null;
    return (
      <Box
        className={classes.card}
        role="group"
        aria-label={String(props.title ?? '')}
      >
        <Box className={classes.head}>
          <span className={classes.icon} aria-hidden="true">
            <EditOutlinedIcon />
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
        {statement && (
          <Typography variant="body1" className={classes.summary}>
            {statement}
          </Typography>
        )}
        {section('Current rule', props.current)}
        {section('Change', props.changes, classes.changeSection)}
        {question && (
          <Typography
            variant="body1"
            className={`${classes.summary} ${classes.askBelow}`}
          >
            <span className={classes.question}>{question}</span>
          </Typography>
        )}
        <Box className={classes.footer}>
          {children(props.footer, buildChild)}
        </Box>
        {/* Under the choices (the footer), not above them as in AskCard. */}
        {children(props.answer, buildChild)}
      </Box>
    );
  },
);

export const RuleLine = createComponentImplementation(
  RuleLineApi,
  ({ props }) => {
    const classes = useCardStyles();
    let mark: ReactNode = null;
    if (props.mark === 'pass') {
      mark = (
        <CheckIcon
          titleAccess="follows the rule"
          className={`${classes.mark} ${classes.pass}`}
        />
      );
    } else if (props.mark === 'fail') {
      mark = (
        <CloseIcon
          titleAccess="doesn't follow the rule"
          className={`${classes.mark} ${classes.fail}`}
        />
      );
    }
    return (
      <Box className={classes.line}>
        <Typography variant="body2" className={classes.lineLabel}>
          {props.label}
        </Typography>
        <Box className={classes.lineEnd}>
          <Typography variant="body2" className={classes.lineValue}>
            {props.value}
            {mark}
          </Typography>
          {props.hint && (
            <Typography variant="caption" color="textSecondary">
              {props.hint}
            </Typography>
          )}
        </Box>
      </Box>
    );
  },
);

export const ChangeRow = createComponentImplementation(
  ChangeRowApi,
  ({ props }) => {
    const classes = useCardStyles();
    const chip = (text: string | undefined, extra: string) => (
      <span className={`${classes.chip} ${extra}`}>{text}</span>
    );
    const arrow = <span aria-hidden="true">→</span>;
    let values: ReactNode;
    switch (props.state) {
      case 'added':
        values = (
          <>
            <span className={classes.tag}>new</span>
            {chip(props.after, classes.after)}
          </>
        );
        break;
      case 'removed':
        values = (
          <>
            {chip(props.before, classes.before)}
            <span className={classes.tag}>removed</span>
          </>
        );
        break;
      case 'pick':
        values = (
          <>
            {chip(props.before, classes.before)}
            {arrow}
            {chip('choose below', classes.pick)}
          </>
        );
        break;
      default:
        values = (
          <>
            {chip(props.before, classes.before)}
            {arrow}
            {chip(props.after, classes.after)}
          </>
        );
    }
    return (
      <Box className={classes.change}>
        <Typography variant="body2" className={classes.changeLabel}>
          {props.label}
        </Typography>
        <span className={classes.values}>{values}</span>
      </Box>
    );
  },
);

export const OptionTile = createComponentImplementation(
  OptionTileApi,
  ({ props }) => {
    const classes = useCardStyles();
    const disabled = useContext(AgentUiDisabled);
    return (
      <ButtonBase
        className={classes.option}
        aria-label={`Option ${props.badge}: ${props.value}`}
        disabled={disabled}
        onClick={() => props.action?.()}
      >
        <span className={classes.badge} aria-hidden="true">
          {props.badge}
        </span>
        <Typography variant="body2" component="span">
          {props.value}
        </Typography>
      </ButtonBase>
    );
  },
);
