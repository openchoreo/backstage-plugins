import { createContext, useContext, useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Chip from '@material-ui/core/Chip';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import SaveOutlinedIcon from '@material-ui/icons/SaveOutlined';
import { useApi } from '@backstage/core-plugin-api';
import {
  portalAssistantApiRef,
  type CheckStatus,
  type ConfirmationRequired,
  type ConfirmResult,
} from '../../api/PortalAssistantApi';
import { useButtonStyles, useCardStyles } from '../AgentUi/cardStyles';
import { OptionRow } from '../AgentUi/OptionRow';
import { SomethingElseButton } from '../AgentUi/AskCard';
import { ResultChip } from '../AgentUi/TestCard';

/** The check as it is after a save, for the chat to carry on with it. */
export type SavedCheck = {
  checkId: string;
  kind: ConfirmationRequired['kind'];
  /** Its name now: renamed when the suggested name was applied. */
  name: string;
  /** Set when the save gave it one: a new check, or an applied suggestion. */
  description?: string;
  /** The saved rule's conditions, as JSON (like ChatScope.currentRule). */
  rule: string;
  factIds?: string[];
  appliesTo?: string[];
  /** Its status now. */
  status: CheckStatus;
  /** An edit of a check that was published before this save. */
  wasPublished: boolean;
};

function savedCheck(
  card: ConfirmationRequired,
  result: ConfirmResult,
  applyTexts: boolean,
): SavedCheck {
  const applied = (field: string) =>
    applyTexts
      ? card.text_changes?.find(change => change.field === field)?.new
      : undefined;
  return {
    checkId: result.check_id,
    kind: card.kind,
    name: applied('name') ?? card.check_name,
    description:
      applied('description') ??
      (card.kind === 'create' ? card.description ?? undefined : undefined),
    rule: card.new_rule,
    factIds: card.fact_ids,
    appliesTo: card.applies_to,
    status: result.status,
    wasPublished: card.kind === 'update' && card.status === 'published',
  };
}

/**
 * Draws the picker to test the card's check on a component. The drawer
 * provides it, since it knows the catalog and sends the test as the next
 * message; without it the card offers no test.
 */
export const ConfirmCardTestPicker = createContext<
  ((card: ConfirmationRequired) => ReactNode) | undefined
>(undefined);

/**
 * Skips the card's test: the drawer asks for the card again, ready to save
 * (the agent rebuilds it without a model call). Without it a card that
 * offers a test also offers to save.
 */
export const ConfirmCardSkipTest = createContext<(() => void) | undefined>(
  undefined,
);

/**
 * The option that opens the list of areas you can check, and the words it
 * sends (2026-11-25: areas, not facts).
 */
export const SHOW_FACTS = {
  label: 'Show me the different areas I can write checks for',
  description:
    'See the main areas you can write checks for, and the facts in each',
};

/**
 * What comes after a beginner tested their practice check (the welcome's
 * example): the facts list, as a user familiar with checks sees it, or
 * their own request. Without it the card offers to save, as any other.
 */
export const ConfirmCardNextStep = createContext<
  { onShowFacts: () => void; onSomethingElse: () => void } | undefined
>(undefined);

// The card's frame, sections and buttons come from the shared card styles
// (../AgentUi/cardStyles), so it looks like the edit question's change card.
const useStyles = makeStyles(theme => ({
  head: { gridTemplateColumns: 'auto minmax(0, 1fr) auto' },
  // The test's heading with its result, highlighted as in the test card.
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  // The reply's own words (e.g. a dry-run summary), as Markdown.
  note: {
    '& > :first-child': { marginTop: 0 },
    '& > :last-child': { marginBottom: 0 },
    '& p, & ul': { margin: theme.spacing(0, 0, 0.75) },
    '& ul': { paddingLeft: theme.spacing(2.5) },
  },
  chip: { gridRow: 'span 2' },
  published: {
    color: theme.palette.success.main,
    borderColor: alpha(theme.palette.success.main, 0.5),
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(0.5),
  },
  condition: {
    fontFamily: 'monospace',
    fontSize: 12,
    overflowWrap: 'anywhere',
  },
  json: {
    fontFamily: 'monospace',
    fontSize: 12,
    margin: 0,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  line: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
  },
  options: { display: 'grid', gap: theme.spacing(1) },
  buttons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  footer: {
    display: 'grid',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 1.75),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  ok: { color: theme.palette.success.main },
  warn: { color: theme.palette.warning.main },
  bad: { color: theme.palette.error.main },
}));

const OPERATOR_SIGNS: Record<string, string> = {
  equal: '=',
  notEqual: '≠',
  greaterThan: '>',
  greaterThanInclusive: '≥',
  lessThan: '<',
  lessThanInclusive: '≤',
  in: 'in',
  notIn: 'not in',
};

type Leaf = { fact: string; operator: string; value: unknown };

/** A flat all/any rule as one line per condition; null for anything else. */
function conditionLines(
  ruleJson: string,
): { joiner: 'all' | 'any'; leaves: Leaf[] } | null {
  let rule: Record<string, unknown>;
  try {
    rule = JSON.parse(ruleJson);
  } catch {
    return null;
  }
  const joiner = (['all', 'any'] as const).find(key =>
    Array.isArray(rule?.[key]),
  );
  if (!joiner) return null;
  const leaves = rule[joiner] as Leaf[];
  const flat = leaves.every(
    leaf =>
      leaf &&
      typeof leaf.fact === 'string' &&
      typeof leaf.operator === 'string',
  );
  return flat ? { joiner, leaves } : null;
}

/** The rule as readable conditions, or the JSON when it's nested. */
const RuleView = ({ ruleJson }: { ruleJson: string }) => {
  const classes = useStyles();
  const lines = conditionLines(ruleJson);
  if (!lines) return <pre className={classes.json}>{ruleJson}</pre>;
  return (
    <Box>
      {lines.leaves.length > 1 && (
        <Typography variant="caption" color="textSecondary">
          {lines.joiner === 'all' ? 'All of:' : 'Any of:'}
        </Typography>
      )}
      {lines.leaves.map((leaf, i) => (
        <Typography key={i} className={classes.condition}>
          {leaf.fact} {OPERATOR_SIGNS[leaf.operator] ?? leaf.operator}{' '}
          {JSON.stringify(leaf.value)}
        </Typography>
      ))}
    </Box>
  );
};

type Choice = { status: CheckStatus; label: string; description: string };

/** The buttons the card offers, by kind and the check's current status. */
function choicesFor(card: ConfirmationRequired): Choice[] {
  if (card.kind === 'update' && card.status === 'published') {
    return [
      {
        status: 'published',
        label: 'Save and keep published',
        description: "Every entity's score uses the new rule at once",
      },
      {
        status: 'draft',
        label: 'Save as draft (unpublish)',
        description: 'Stops scoring until you publish it again',
      },
    ];
  }
  return [
    {
      status: 'draft',
      label: 'Save as draft',
      description: "Keep it to review; scores don't change yet",
    },
    {
      status: 'published',
      label: 'Save and publish',
      description: "Every entity's score includes it at once",
    },
  ];
}

type Phase =
  | { name: 'open' }
  | { name: 'saving'; asked: CheckStatus }
  | { name: 'saved'; result: ConfirmResult; asked: CheckStatus }
  | { name: 'failed'; message: string }
  | { name: 'cancelled' };

/**
 * The confirm card for a check change the assistant drafted — the one place
 * the change is shown. Nothing is saved until the user picks a button; the
 * change itself is fixed by the card's signed token, the click only picks
 * the status to end in and whether the suggested texts are applied. One
 * save per card. Until it is saved, the check can be tested on a component
 * first (see ConfirmCardTestPicker).
 */
export const ConfirmCard = ({
  card,
  onSaved,
  plain,
  note,
  testResult,
  superseded = false,
}: {
  card: ConfirmationRequired;
  /**
   * Called after a save, e.g. to refresh a check list, with the check as
   * saved so the chat can carry on with it.
   */
  onSaved?: (result: ConfirmResult, saved: SavedCheck) => void;
  /**
   * The rule in plain words, when the agent sent the card as an A2UI save
   * card: what changes for an edit, the conditions for a new check.
   */
  plain?: ReactNode;
  /**
   * The reply's own words, shown at the top when the agent sent the card as
   * an A2UI save card (the drawer then shows the card instead of the text).
   */
  note?: ReactNode;
  /**
   * The test the change was just tried in, shown above the note: "Tested on
   * order-api" with its result highlighted (Passed / Failed / Doesn't apply,
   * as in the test card) and a line per fact, ticked or crossed.
   */
  testResult?: {
    title: string;
    status?: 'passed' | 'failed' | 'not-applicable';
    lines?: ReactNode;
  };
  /**
   * A newer card for the same chat came after this one: an unsaved card
   * can't be saved any more, so one draft is never saved twice.
   */
  superseded?: boolean;
}) => {
  const classes = useStyles();
  const cardClasses = useCardStyles();
  const buttonClasses = useButtonStyles();
  const api = useApi(portalAssistantApiRef);
  const testPicker = useContext(ConfirmCardTestPicker);
  const skipTest = useContext(ConfirmCardSkipTest);
  const nextStep = useContext(ConfirmCardNextStep);
  const [phase, setPhase] = useState<Phase>({ name: 'open' });
  const [factsAsked, setFactsAsked] = useState(false);
  const [applyTexts, setApplyTexts] = useState(true);
  const [copied, setCopied] = useState(false);
  const textChanges = card.text_changes ?? [];
  const problems = card.problems ?? [];
  const warnings = card.warnings ?? [];
  const isNew = card.kind === 'create';

  const save = async (status: CheckStatus) => {
    setPhase({ name: 'saving', asked: status });
    try {
      const result = await api.confirmChange(card.token, status, applyTexts);
      setPhase({ name: 'saved', result, asked: status });
      onSaved?.(result, savedCheck(card, result, applyTexts));
    } catch (e) {
      setPhase({
        name: 'failed',
        message:
          e instanceof Error ? e.message : 'The change could not be saved.',
      });
    }
  };

  // The rule in the form the check editor's Rule field takes.
  const copyRule = async () => {
    try {
      const conditions = JSON.parse(card.new_rule);
      await navigator.clipboard.writeText(
        JSON.stringify({ conditions }, null, 2),
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  let statusLabel = 'Draft';
  if (isNew) statusLabel = 'New check';
  else if (card.status === 'published') statusLabel = 'Published';
  // Only a card that can still be saved: nothing to test before then.
  const open = phase.name === 'open' && !superseded;
  // A test is offered until the agent says the card was tested, or the user
  // skipped it. With the drawer's Skip, the test comes first and the save
  // buttons with the next card; without it, the card offers both.
  const offersTest =
    card.valid && !!testPicker && !card.tested && !card.test_skipped;
  const testFirst = offersTest && !!skipTest;
  // A beginner's practice check, tested: what to do next instead of saving.
  const practiceDone = !!card.example && !!card.tested && !!nextStep;
  let testWords =
    "Not sure it's right? Test it on a component before you save.";
  if (card.example && testFirst) {
    testWords =
      'This is what a check looks like. Pick one of your components and test it, to see if it passes.';
  } else if (testFirst) {
    testWords = 'Test it on a component first, to see whether it passes.';
  }

  return (
    <Box
      className={cardClasses.card}
      role="group"
      aria-label={`${isNew ? 'Create' : 'Save'} check ${card.check_name}`}
    >
      <Box className={`${cardClasses.head} ${classes.head}`}>
        <span className={cardClasses.icon} aria-hidden="true">
          {isNew ? <AddIcon /> : <SaveOutlinedIcon />}
        </span>
        <Typography variant="body2" className={cardClasses.title}>
          {card.check_name}
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={statusLabel}
          className={`${classes.chip} ${
            card.status === 'published' ? classes.published : ''
          }`}
        />
        {isNew && (
          <Typography variant="caption" className={cardClasses.subtitle}>
            {[
              card.fact_ids?.join(', '),
              card.category,
              card.tier && `${card.tier} tier`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        )}
      </Box>

      {testResult && (
        <Box className={cardClasses.section}>
          <Box className={classes.resultHead}>
            <Typography variant="body2" className={cardClasses.title}>
              {testResult.title}
            </Typography>
            {testResult.status && <ResultChip status={testResult.status} />}
          </Box>
          {testResult.lines}
        </Box>
      )}

      {note && (
        <Box className={`${cardClasses.summary} ${classes.note}`}>{note}</Box>
      )}

      {isNew && card.description && (
        <Typography variant="body1" className={cardClasses.summary}>
          {card.description}
        </Typography>
      )}

      {plain && (
        <Box className={`${cardClasses.section} ${cardClasses.changeSection}`}>
          <span className={cardClasses.sectionLabel}>
            {isNew ? 'What it checks' : 'Change'}
          </span>
          {plain}
        </Box>
      )}

      {isNew && !!card.applies_to?.length && (
        <Box className={cardClasses.section}>
          <Typography variant="body2">
            Applies to:{' '}
            {card.applies_to
              .map(kind => kind.charAt(0).toUpperCase() + kind.slice(1))
              .join(', ')}
          </Typography>
        </Box>
      )}

      <Box className={cardClasses.section}>
        <Box className={classes.label}>
          <span className={cardClasses.sectionLabel}>
            {isNew ? 'Rule' : 'New rule'}
          </span>
          <Tooltip title={copied ? 'Copied' : 'Copy rule'}>
            <IconButton
              size="small"
              style={{ padding: 2 }}
              aria-label="Copy rule"
              onClick={copyRule}
            >
              <FileCopyOutlinedIcon style={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <RuleView ruleJson={card.new_rule} />
        {card.current_rule && (
          <details>
            <summary>
              <Typography variant="caption" color="textSecondary">
                Current rule
              </Typography>
            </summary>
            <RuleView ruleJson={card.current_rule} />
          </details>
        )}
      </Box>

      {textChanges.length > 0 && (
        <Box className={cardClasses.section}>
          <span className={cardClasses.sectionLabel}>Suggested text</span>
          {textChanges.map(change =>
            // The header already shows the current name.
            change.field === 'name' ? (
              <Typography key={change.field} variant="body2">
                <strong>Rename to:</strong> {change.new}
              </Typography>
            ) : (
              <Typography key={change.field} variant="body2">
                <strong>{change.label}:</strong>{' '}
                {change.old && (
                  <>
                    <s className={cardClasses.before}>{change.old}</s> →{' '}
                  </>
                )}
                {change.new}
              </Typography>
            ),
          )}
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                color="primary"
                checked={applyTexts}
                disabled={!open}
                onChange={e => setApplyTexts(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                Also apply the suggested text
              </Typography>
            }
          />
        </Box>
      )}

      <Box className={cardClasses.section}>
        {warnings.length > 0 && (
          <Box role="note" aria-label="Check before saving">
            {warnings.map(warning => (
              <Box key={warning} className={classes.line}>
                <ReportProblemOutlinedIcon
                  fontSize="small"
                  className={classes.warn}
                />
                <Typography variant="body2">{warning}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {card.valid ? (
          <Box className={classes.line}>
            <CheckCircleOutlineIcon fontSize="small" className={classes.ok} />
            <Typography variant="body2">Rule is valid</Typography>
          </Box>
        ) : (
          <Box>
            <Box className={classes.line}>
              <ErrorOutlineIcon fontSize="small" className={classes.bad} />
              <Typography variant="body2">
                This rule can't be saved yet:
              </Typography>
            </Box>
            {problems.map(problem => (
              <Typography key={problem} variant="body2">
                • {problem}
              </Typography>
            ))}
          </Box>
        )}
      </Box>

      {/* Once tested or skipped (the agent says so), what's left is to save. */}
      {open && offersTest && testPicker && (
        <Box className={cardClasses.section}>
          <Typography variant="body2">{testWords}</Typography>
          {testPicker(card)}
        </Box>
      )}

      <Box className={classes.footer}>
        {superseded && phase.name === 'open' && (
          <Typography variant="body2" color="textSecondary">
            A newer version of this check is below.
          </Typography>
        )}
        {/* The save choices, as options: the one picked stays in view,
            ticked (a spinner while it saves). No Cancel, and no Skip: a
            valid card goes on to the test, then to saving. A rule that
            can't be saved can be dismissed. */}
        {practiceDone && nextStep && (
          <>
            {/* The question in the reply card's own size and colour. */}
            <Typography variant="body1" className={cardClasses.question}>
              Would you like to see what else you can check, or do you have your
              own rule in mind?
            </Typography>
            <Box className={classes.options}>
              <OptionRow
                label={SHOW_FACTS.label}
                description={SHOW_FACTS.description}
                selected={factsAsked}
                disabled={!open || factsAsked}
                onClick={() => {
                  setFactsAsked(true);
                  nextStep.onShowFacts();
                }}
              />
              {/* The same words as the new check intro's (newCheckIntro). */}
              <SomethingElseButton
                label="Describe your own check"
                disabled={!open || factsAsked}
                onClick={nextStep.onSomethingElse}
              />
            </Box>
          </>
        )}
        {card.valid &&
          !testFirst &&
          !practiceDone &&
          (open || phase.name === 'saving' || phase.name === 'saved') && (
            <Box className={classes.options}>
              {choicesFor(card).map(choice => {
                const asked =
                  phase.name === 'saving' || phase.name === 'saved'
                    ? phase.asked
                    : undefined;
                return (
                  <OptionRow
                    key={choice.status}
                    label={choice.label}
                    description={choice.description}
                    selected={asked === choice.status}
                    busy={phase.name === 'saving' && asked === choice.status}
                    disabled={!open}
                    onClick={() => save(choice.status)}
                  />
                );
              })}
            </Box>
          )}
        {phase.name === 'saving' && (
          <Typography variant="body2">Saving…</Typography>
        )}
        {open && testFirst && !card.example && (
          <Typography variant="caption" color="textSecondary">
            Save as draft and Save and publish come after the test.
          </Typography>
        )}
        {open && !card.valid && (
          <Box className={classes.buttons}>
            <Button
              size="small"
              className={`${buttonClasses.button} ${buttonClasses.borderless}`}
              onClick={() => setPhase({ name: 'cancelled' })}
            >
              Dismiss
            </Button>
          </Box>
        )}

        {phase.name === 'saved' && (
          <Box className={classes.line} role="status">
            {phase.result.status === phase.asked ? (
              <CheckCircleOutlineIcon fontSize="small" className={classes.ok} />
            ) : (
              <ReportProblemOutlinedIcon
                fontSize="small"
                className={classes.warn}
              />
            )}
            <Typography variant="body2">{phase.result.message}</Typography>
          </Box>
        )}
        {phase.name === 'failed' && (
          <Box className={classes.line} role="alert">
            <ErrorOutlineIcon fontSize="small" className={classes.bad} />
            <Typography variant="body2">{phase.message}</Typography>
          </Box>
        )}
        {phase.name === 'cancelled' && (
          <Typography variant="body2" color="textSecondary">
            Not saved. Use Copy rule to paste it into the form instead.
          </Typography>
        )}
      </Box>
    </Box>
  );
};
