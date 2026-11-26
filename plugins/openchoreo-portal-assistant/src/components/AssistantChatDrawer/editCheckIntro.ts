import type { ChatScope, FactRetriever } from '../../api/PortalAssistantApi';
import { AGENT_UI_CATALOG_ID } from '../AgentUi/catalog';

/**
 * The first message of an "Edit with AI" chat, drawn by the drawer rather
 * than written by the agent: the same ReplyCard the agent sends, with the
 * check's current rule in plain words, a question to click and a button to
 * describe your own change. The agent never sees this message — it gets the
 * check from the scope. A new check's chat opens with the level picker
 * instead.
 */

/**
 * The questions under the intro to an edited check. No "How can I improve
 * this?" (2026-11-25): asking for ideas in your own words still works.
 */
export const EDIT_CHECK_QUESTIONS = ['Explain this rule'];

type Leaf = { fact: string; operator: string; value: unknown };

// Longest fact description used as a label; longer ones fall back to the
// fact name. Same as _LABEL_MAX in the agent's rule_view.py.
const LABEL_MAX = 48;

/** A rule's conditions when it is one flat "all" group (or a single "any"). */
function flatLeaves(ruleJson: string | undefined): Leaf[] | null {
  let rule: unknown;
  try {
    rule = JSON.parse(ruleJson ?? '');
  } catch {
    return null;
  }
  if (rule && typeof rule === 'object' && 'conditions' in rule) {
    rule = (rule as { conditions: unknown }).conditions;
  }
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;
  const entries = Object.entries(rule);
  if (entries.length !== 1) return null;
  const [[joiner, group]] = entries;
  if ((joiner !== 'all' && joiner !== 'any') || !Array.isArray(group)) {
    return null;
  }
  if (joiner === 'any' && group.length > 1) return null; // rows read as "all of these"
  const flat = group.every(
    leaf =>
      leaf &&
      typeof leaf === 'object' &&
      typeof leaf.fact === 'string' &&
      typeof leaf.operator === 'string' &&
      // A path reads a value inside the fact; the row would name the whole fact.
      !('path' in leaf),
  );
  return flat ? (group as Leaf[]) : null;
}

const fmt = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(fmt).join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
};

/** A condition's operator and value in plain words, e.g. "3 or more". */
function valueWords(operator: string, value: unknown): string {
  if (
    typeof value === 'boolean' &&
    (operator === 'equal' || operator === 'notEqual')
  ) {
    return value === (operator === 'equal') ? 'Yes' : 'No';
  }
  const v = fmt(value);
  const words: Record<string, string> = {
    equal: typeof value === 'number' ? `exactly ${v}` : v,
    notEqual: `not ${v}`,
    greaterThanInclusive: `${v} or more`,
    greaterThan: `more than ${v}`,
    lessThanInclusive: `${v} or less`,
    lessThan: `less than ${v}`,
    in: `one of ${v}`,
    notIn: `none of ${v}`,
    contains: `contains ${v}`,
    doesNotContain: `doesn't contain ${v}`,
  };
  return words[operator] ?? `${operator} ${v}`;
}

/** Fact name → its short description, from the facts forwarded with the chat. */
function factLabels(retrievers: FactRetriever[] | undefined) {
  const labels = new Map<string, string>();
  for (const retriever of retrievers ?? []) {
    for (const fact of retriever.facts ?? []) {
      const text = (fact.description ?? '')
        .split(':')[0]
        .trim()
        .replace(/\.$/, '');
      if (fact.name && text && text.length <= LABEL_MAX) {
        labels.set(fact.name, text);
      }
    }
  }
  return labels;
}

/** "githubRequiredApprovingReviewCount" → "Required approving review count". */
function humanize(fact: string): string {
  let words = fact.replace(/([a-z0-9])(?=[A-Z])/g, '$1 ').split(/\s+/);
  if (words.length > 1 && words[0].toLowerCase() === 'github') {
    words = words.slice(1);
  }
  const text = words.join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The rule as (label, value in words) lines, or null when it can't be
 * shown exactly. Mirrors rule_lines in the agent's rule_view.py, so the
 * intro reads like the agent's own cards.
 */
export function ruleLines(
  ruleJson: string | undefined,
  retrievers: FactRetriever[] | undefined,
): [string, string][] | null {
  const leaves = flatLeaves(ruleJson);
  if (!leaves || new Set(leaves.map(l => l.fact)).size !== leaves.length) {
    return null;
  }
  const labels = factLabels(retrievers);
  return leaves.map(({ fact, operator, value }) => [
    labels.get(fact) ?? humanize(fact),
    valueWords(operator, value),
  ]);
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** The intro to an edited check as A2UI messages. */
export function editCheckIntro(scope: ChatScope): unknown[] {
  const rows =
    ruleLines(scope.currentRule, scope.availableFactRetrievers) ?? [];
  const lines = rows.map(([label, value], i) => ({
    id: `line_${i}`,
    component: 'ReplyLine',
    label,
    value,
  }));
  const sections =
    lines.length > 0
      ? [
          {
            id: 'section',
            component: 'ReplySection',
            label: 'Current rule',
            lines: lines.map(line => line.id),
          },
        ]
      : [];
  const choices = EDIT_CHECK_QUESTIONS.map((question, i) => ({
    id: `choice_${i}`,
    component: 'PickRow',
    label: question,
    text: question,
    action: { event: { name: 'pick_choice', userMessage: question } },
  }));
  // Same text box as the agent's cards: what is typed is written to this
  // path and sent from it.
  const text = { '@path': '/reply/text' };
  const answer = {
    id: 'answer',
    component: 'AskField',
    button: 'Describe your change',
    placeholder:
      'Describe the change you want, for example: require 3 approving reviews',
    value: text,
    action: { event: { name: 'type_answer', userMessage: text } },
  };

  const root: Record<string, unknown> = {
    id: 'root',
    component: 'ReplyCard',
    title: 'Edit this check',
    summary: [
      scope.checkDescription && sentence(scope.checkDescription.trim()),
      "I'll show you any change before it's saved.",
      'What would you like to do?',
    ]
      .filter(Boolean)
      .join(' '),
    sections: sections.map(section => section.id),
    choices: choices.map(choice => choice.id),
    answer: [answer.id],
  };
  if (scope.checkName) root.subtitle = scope.checkName;

  return [
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'check-edit-intro',
        catalogId: AGENT_UI_CATALOG_ID,
        components: [root, ...sections, ...lines, ...choices, answer],
      },
    },
  ];
}
