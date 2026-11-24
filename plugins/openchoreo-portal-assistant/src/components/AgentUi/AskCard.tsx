import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import ButtonBase from '@material-ui/core/ButtonBase';
import InputBase from '@material-ui/core/InputBase';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles } from '@material-ui/core/styles';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import { z } from 'zod';
import { createComponentImplementation } from '@a2ui/react';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import { splitQuestion } from './ChangeCard';
import {
  children,
  useButtonStyles,
  useCardStyles,
  type ChildRef,
} from './cardStyles';
import {
  AgentUiComposerContext,
  AgentUiDisabled,
  AgentUiInOptions,
} from './context';

/**
 * A check edit reply that asks instead of proposing a rule, as a card: the
 * rule in plain words with an editor for each number or yes/no value, or
 * the reply's numbered options, plus a text box. The agent builds it
 * (src/agent/ask_view.py); every answer is sent as the user's next message.
 *
 * The editors' changes and removals wait until Send, which sends them with
 * what is typed as one message, so several values change at once. A typed or edited answer
 * goes through the surface's data model, the A2UI way: the part writes its
 * sentence to its bound path (`value` / `message`) and its action's
 * `userMessage` reads that same path when it is sent.
 *
 * In a check authoring chat the drawer gives the card its message box
 * (AgentUiComposerContext): the editors' changes are written there as one
 * sentence and sent with the drawer's own Send, and the text box becomes a
 * "Tell me something else" button that moves the cursor there — one place to type,
 * one Send.
 */

export const AskCardApi = {
  name: 'AskCard',
  schema: z.object({
    title: CommonSchemas.DynamicString,
    subtitle: CommonSchemas.DynamicString.optional(),
    summary: CommonSchemas.DynamicString.optional(),
    current: CommonSchemas.ChildList,
    editors: CommonSchemas.ChildList,
    options: CommonSchemas.ChildList,
    answer: CommonSchemas.ChildList,
    footer: CommonSchemas.ChildList,
  }),
};

export const ValueEditorApi = {
  name: 'ValueEditor',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    kind: z.enum(['number', 'choice']),
    value: z.union([z.number(), z.string()]),
    // The sentence sent, with {value} for the new value in words.
    template: z.string(),
    comparison: z.string().optional(),
    comparisons: z.array(z.string()).optional(),
    choices: z.array(z.string()).optional(),
    message: CommonSchemas.DynamicString,
    action: CommonSchemas.Action,
    remove: CommonSchemas.Action.optional(),
  }),
};

export const AskOptionApi = {
  name: 'AskOption',
  schema: z.object({
    badge: CommonSchemas.DynamicString,
    label: CommonSchemas.DynamicString,
    action: CommonSchemas.Action,
    // An option that needs a number: where its field starts, and the
    // sentence sent, with {value} for the number.
    value: z.number().optional(),
    template: z.string().optional(),
    message: CommonSchemas.DynamicString.optional(),
  }),
};

export const AskFieldApi = {
  name: 'AskField',
  schema: z.object({
    placeholder: CommonSchemas.DynamicString.optional(),
    // The pencil button's words with the drawer's message box; "Tell me
    // something else" when not set.
    button: CommonSchemas.DynamicString.optional(),
    value: CommonSchemas.DynamicString,
    action: CommonSchemas.Action,
  }),
};

const useStyles = makeStyles(theme => {
  const control = {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  };
  const focus = {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 1,
  };
  return {
    editor: {
      display: 'grid',
      gap: theme.spacing(0.75),
      '& + &': {
        borderTop: `1px dashed ${theme.palette.divider}`,
        paddingTop: theme.spacing(1),
      },
    },
    editorTop: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: theme.spacing(1.25),
    },
    remove: {
      fontSize: 12,
      color: theme.palette.text.secondary,
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
      '&:hover': { color: theme.palette.error.main },
      '&.Mui-focusVisible': focus,
    },
    removed: {
      textDecoration: 'line-through',
      color: theme.palette.text.disabled,
    },
    controls: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    grow: { flex: 1 },
    select: {
      ...control,
      padding: theme.spacing(0.5, 1),
      '&:focus-visible': focus,
    },
    stepper: {
      ...control,
      display: 'inline-flex',
      alignItems: 'stretch',
      overflow: 'hidden',
    },
    step: {
      width: 28,
      fontSize: 16,
      color: theme.palette.primary.main,
      '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
      '&.Mui-focusVisible': focus,
      '&.Mui-disabled': { opacity: 0.5 },
    },
    number: {
      width: 44,
      fontSize: theme.typography.body2.fontSize,
      color: theme.palette.text.primary,
      borderLeft: `1px solid ${theme.palette.divider}`,
      borderRight: `1px solid ${theme.palette.divider}`,
      '& input': {
        textAlign: 'center',
        padding: theme.spacing(0.5, 0),
        fontVariantNumeric: 'tabular-nums',
        MozAppearance: 'textfield',
      },
      '& input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button':
        { WebkitAppearance: 'none', margin: 0 },
    },
    toggle: { ...control, display: 'inline-flex', overflow: 'hidden' },
    toggleItem: {
      padding: theme.spacing(0.5, 1.5),
      fontSize: theme.typography.body2.fontSize,
      color: theme.palette.text.secondary,
      '& + &': { borderLeft: `1px solid ${theme.palette.divider}` },
      '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
      // Filled, so the chosen side stands out from the other at a glance.
      '&[aria-pressed="true"]': {
        color: theme.palette.primary.contrastText,
        fontWeight: 600,
        backgroundColor: theme.palette.primary.main,
      },
      '&.Mui-focusVisible': focus,
    },
    option: {
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: theme.spacing(1.25),
      width: '100%',
      textAlign: 'left',
      padding: theme.spacing(0.875, 1.25),
      border: `1px solid ${alpha(theme.palette.primary.main, 0.55)}`,
      borderRadius: theme.shape.borderRadius,
      color: theme.palette.text.primary,
      '& > svg': { fontSize: 16, color: theme.palette.primary.main },
    },
    optionButton: {
      '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
      '&.Mui-focusVisible': focus,
      '&.Mui-disabled': { opacity: 0.5 },
    },
    optionControls: { gridColumn: '2 / 4' },
    answer: {
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1.25, 1.75),
      borderTop: `1px solid ${theme.palette.divider}`,
    },
    // "Tell me something else": one button, the width of its words, on the
    // options' left edge.
    own: {
      width: 'auto',
      justifySelf: 'start',
      gridTemplateColumns: 'auto auto',
    },
    field: {
      ...control,
      flex: 1,
      minWidth: 0,
      padding: theme.spacing(0.25, 1),
      '&.Mui-focused': focus,
    },
  };
});

const fill = (template: string, value: string) =>
  template.replace('{value}', value);

/**
 * "Approving reviews …" → "approving reviews …"; "README file" stays. Same
 * rule as ask_view.py's `_lower_first`, which turned the name into the label.
 */
const lowerFirst = (text: string) =>
  /^.[a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;

/** The editors' changes, in card order, for Send to send with the text. */
const AskChanges = createContext<{
  changes: string[];
  stage: (editor: object, change: string | undefined) => void;
}>({ changes: [], stage: () => {} });

/** A whole-number field with − / + buttons. */
const Stepper = ({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  disabled: boolean;
}) => {
  const classes = useStyles();
  return (
    <span className={classes.stepper}>
      <ButtonBase
        className={classes.step}
        aria-label="Fewer"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </ButtonBase>
      <InputBase
        className={classes.number}
        type="number"
        value={value}
        disabled={disabled}
        inputProps={{ 'aria-label': label, min: 0, step: 1 }}
        onChange={e => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n) && n >= 0) onChange(n);
        }}
      />
      <ButtonBase
        className={classes.step}
        aria-label="More"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
      >
        +
      </ButtonBase>
    </span>
  );
};

const UseButton = ({
  label,
  disabled,
  onClick,
  type = 'button',
}: {
  label: string;
  disabled: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) => {
  const buttonClasses = useButtonStyles();
  return (
    <Button
      size="small"
      variant="contained"
      type={type}
      className={`${buttonClasses.button} ${
        disabled ? '' : buttonClasses.primary
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
};

export const AskCard = createComponentImplementation(
  AskCardApi,
  ({ props, buildChild }) => {
    const cardClasses = useCardStyles();
    // Each editor's change, keyed by editor; editors register as they mount,
    // so the map keeps the card's order.
    const [staged, setStaged] = useState(
      () => new Map<object, string | undefined>(),
    );
    const stage = useCallback(
      (editor: object, change: string | undefined) =>
        setStaged(prev =>
          prev.has(editor) && prev.get(editor) === change
            ? prev
            : new Map(prev).set(editor, change),
        ),
      [],
    );
    const changes = useMemo(
      () => ({
        changes: Array.from(staged.values()).filter(
          (change): change is string => Boolean(change),
        ),
        stage,
      }),
      [staged, stage],
    );
    // With the drawer's message box, the editors' changes are written there
    // as they happen (not on mount: that would clear what the user typed).
    const composer = useContext(AgentUiComposerContext);
    const written = useRef('');
    useEffect(() => {
      const text = changes.changes.join('. ');
      if (!composer || text === written.current) return;
      written.current = text;
      composer.write(text);
    }, [composer, changes]);
    const [statement, question] = splitQuestion(String(props.summary ?? ''));
    const section = (
      label: string | undefined,
      refs: ChildRef[] | undefined,
      tinted = false,
    ) =>
      refs && refs.length > 0 ? (
        <Box
          className={`${cardClasses.section} ${
            tinted ? cardClasses.changeSection : ''
          }`}
        >
          {label && <span className={cardClasses.sectionLabel}>{label}</span>}
          {children(refs, buildChild)}
        </Box>
      ) : null;
    return (
      <AskChanges.Provider value={changes}>
        <Box
          className={cardClasses.card}
          role="group"
          aria-label={String(props.title ?? '')}
        >
          <Box className={cardClasses.head}>
            <span className={cardClasses.icon} aria-hidden="true">
              <HelpOutlineIcon />
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
          {statement && (
            <Typography variant="body1" className={cardClasses.summary}>
              {statement}
            </Typography>
          )}
          {section('Current rule', props.current)}
          {section('Change a value', props.editors, true)}
          {question && (
            <Typography
              variant="body1"
              className={`${cardClasses.summary} ${cardClasses.askBelow}`}
            >
              <span className={cardClasses.question}>{question}</span>
            </Typography>
          )}
          {composer && (props.options?.length ?? 0) > 0 ? (
            // The options sit right under the question, with no "Pick
            // one" above them (2026-11-25).
            <Box
              className={`${cardClasses.section} ${cardClasses.changeSection}`}
            >
              {children(props.options, buildChild)}
              <AgentUiInOptions.Provider value>
                {children(props.answer, buildChild)}
              </AgentUiInOptions.Provider>
            </Box>
          ) : (
            <>
              {section(undefined, props.options, true)}
              {children(props.answer, buildChild)}
            </>
          )}
          <Box className={cardClasses.footer}>
            {children(props.footer, buildChild)}
          </Box>
        </Box>
      </AskChanges.Provider>
    );
  },
);

export const ValueEditor = createComponentImplementation(
  ValueEditorApi,
  ({ props }) => {
    const cardClasses = useCardStyles();
    const classes = useStyles();
    const disabled = useContext(AgentUiDisabled);
    const { stage } = useContext(AskChanges);
    const [key] = useState(() => ({}));
    const label = String(props.label ?? '');
    const comparisons = props.comparisons ?? [];
    const [n, setN] = useState(Number(props.value));
    const [comparison, setComparison] = useState(
      props.comparison ?? comparisons[0] ?? '',
    );
    const [choice, setChoice] = useState(String(props.value));
    const [removed, setRemoved] = useState(false);

    const isNumber = props.kind === 'number';
    const changed = isNumber
      ? n !== Number(props.value) || comparison !== props.comparison
      : choice !== String(props.value);
    // A changed or removed value waits for Send, which sends it with the
    // others. The agent's `remove` action only says the condition can be
    // removed; its sentence is the one ask_view.py writes.
    let change: string | undefined;
    if (removed) change = `Remove the condition: ${lowerFirst(label)}`;
    else if (changed) {
      change = fill(props.template, isNumber ? `${comparison} ${n}` : choice);
    }
    useEffect(() => stage(key, change), [stage, key, change]);
    const locked = disabled || removed;

    return (
      <Box className={classes.editor} role="group" aria-label={label}>
        <Box className={classes.editorTop}>
          <Typography
            variant="body2"
            className={`${cardClasses.changeLabel}${
              removed ? ` ${classes.removed}` : ''
            }`}
          >
            {label}
          </Typography>
          {props.remove && (
            <ButtonBase
              className={classes.remove}
              disabled={disabled}
              onClick={() => setRemoved(r => !r)}
            >
              {removed ? 'Keep' : 'Remove'}
            </ButtonBase>
          )}
        </Box>
        <Box className={classes.controls}>
          {isNumber ? (
            <>
              <select
                className={classes.select}
                aria-label="Comparison"
                value={comparison}
                disabled={locked}
                onChange={e => setComparison(e.target.value)}
              >
                {comparisons.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Stepper
                value={n}
                onChange={setN}
                label="Number"
                disabled={locked}
              />
            </>
          ) : (
            <span className={classes.toggle}>
              {(props.choices ?? []).map(c => (
                <ButtonBase
                  key={c}
                  className={classes.toggleItem}
                  aria-pressed={c === choice}
                  disabled={locked}
                  onClick={() => setChoice(c)}
                >
                  {c}
                </ButtonBase>
              ))}
            </span>
          )}
        </Box>
      </Box>
    );
  },
);

export const AskOption = createComponentImplementation(
  AskOptionApi,
  ({ props }) => {
    const cardClasses = useCardStyles();
    const classes = useStyles();
    const disabled = useContext(AgentUiDisabled);
    const [n, setN] = useState(props.value ?? 0);
    const label = String(props.label ?? '');
    const badge = (
      <span className={cardClasses.badge} aria-hidden="true">
        {props.badge}
      </span>
    );
    const text = (
      <Typography variant="body2" component="span">
        {label}
      </Typography>
    );

    if (props.template === undefined) {
      return (
        <ButtonBase
          className={`${classes.option} ${classes.optionButton}`}
          aria-label={`Option ${props.badge}: ${label}`}
          disabled={disabled}
          onClick={() => props.action?.()}
        >
          {badge}
          {text}
          <ArrowForwardIcon aria-hidden="true" />
        </ButtonBase>
      );
    }
    const template = props.template;
    return (
      <Box
        className={classes.option}
        role="group"
        aria-label={`Option ${props.badge}: ${label}`}
      >
        {badge}
        {text}
        <span />
        <Box className={`${classes.controls} ${classes.optionControls}`}>
          <Stepper
            value={n}
            onChange={setN}
            label="Number"
            disabled={disabled}
          />
          <span className={classes.grow} />
          <UseButton
            label="Use this number"
            disabled={disabled}
            onClick={() => {
              props.setMessage?.(fill(template, String(n)));
              props.action?.();
            }}
          />
        </Box>
      </Box>
    );
  },
);

/**
 * "Tell me something else": points the user to the drawer's message box to type
 * their own request. Used under a card's suggestions and under the level
 * picker (with its own ``label``), as one more row on their left edge.
 */
export const SomethingElseButton = ({
  label = 'Tell me something else',
  disabled,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}) => {
  const classes = useStyles();
  return (
    <ButtonBase
      className={`${classes.option} ${classes.optionButton} ${classes.own}`}
      disabled={disabled}
      onClick={onClick}
    >
      <EditOutlinedIcon aria-hidden="true" />
      <Typography variant="body2" component="span">
        {label}
      </Typography>
    </ButtonBase>
  );
};

export const AskField = createComponentImplementation(
  AskFieldApi,
  ({ props }) => {
    const classes = useStyles();
    const disabled = useContext(AgentUiDisabled);
    const { changes } = useContext(AskChanges);
    const composer = useContext(AgentUiComposerContext);
    const inOptions = useContext(AgentUiInOptions);
    const [text, setText] = useState('');
    if (composer) {
      const button = (
        <SomethingElseButton
          label={props.button ? String(props.button) : undefined}
          disabled={disabled}
          onClick={() => composer.focus(String(props.placeholder ?? ''))}
        />
      );
      return inOptions ? (
        button
      ) : (
        <Box className={classes.answer}>{button}</Box>
      );
    }
    const answer = text.trim();
    // The editors' changes, then what is typed, as one message.
    const parts = answer ? [...changes, answer] : changes;
    const send = (e: FormEvent) => {
      e.preventDefault();
      if (parts.length === 0) return;
      props.setValue?.(parts.join('. '));
      props.action?.();
    };
    return (
      <form className={classes.answer} onSubmit={send}>
        <InputBase
          className={classes.field}
          value={text}
          placeholder={String(props.placeholder ?? '')}
          disabled={disabled}
          inputProps={{ 'aria-label': 'Your answer' }}
          onChange={e => setText(e.target.value)}
        />
        <UseButton
          label="Send"
          type="submit"
          disabled={disabled || parts.length === 0}
        />
      </form>
    );
  },
);
