import {
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { propertyKey, siblingString, valueContextAt } from './jsonTree';
import { RULE_OPERATORS, RULE_OPERATOR_DECORATORS } from './operators';

/** A fact the rule can use, from one of the check's chosen retrievers. */
export interface FactOption {
  name: string;
  type: string;
  description?: string;
  retriever: string;
}

/**
 * Where a completion goes inside a string value: between its quotes, or at
 * the cursor with quotes added when the value isn't typed yet.
 */
function stringTarget(
  context: CompletionContext,
  value: SyntaxNode | undefined,
): { from: number; to: number; quote: boolean } | undefined {
  if (!value) return { from: context.pos, to: context.pos, quote: true };
  if (value.name !== 'String') return undefined;
  if (context.pos <= value.from || context.pos >= value.to) return undefined;
  return { from: value.from + 1, to: value.to - 1, quote: false };
}

/** Inserts text and leaves the cursor at `cursor` within it. */
function insertAt(text: string, cursor: number, reopen: boolean) {
  return (view: EditorView, _c: Completion, from: number, to: number) => {
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + cursor },
    });
    if (reopen) startCompletion(view);
  };
}

function factCompletions(
  context: CompletionContext,
  value: SyntaxNode | undefined,
  facts: FactOption[],
): CompletionResult | null {
  const target = stringTarget(context, value);
  if (!target || facts.length === 0) return null;
  return {
    from: target.from,
    to: target.to,
    validFor: /^[\w.-]*$/,
    options: facts.map(fact => ({
      label: fact.name,
      detail: fact.type,
      info: [fact.description, `From ${fact.retriever}.`]
        .filter(Boolean)
        .join('\n\n'),
      type: 'property',
      apply: target.quote ? JSON.stringify(fact.name) : fact.name,
    })),
  };
}

function operatorCompletions(
  context: CompletionContext,
  value: SyntaxNode | undefined,
): CompletionResult | null {
  const target = stringTarget(context, value);
  if (!target) return null;
  // Complete only the part after any decorators already typed.
  const typed = context.state.sliceDoc(target.from, context.pos);
  const from = target.from + typed.lastIndexOf(':') + 1;
  const wrap = (text: string) => (target.quote ? `"${text}"` : text);
  const quoteOffset = target.quote ? 1 : 0;
  return {
    from,
    to: target.to,
    validFor: /^\w*$/,
    options: [
      ...RULE_OPERATORS.map(operator => ({
        label: operator.name,
        info: operator.info,
        type: 'keyword',
        apply: wrap(operator.name),
      })),
      ...RULE_OPERATOR_DECORATORS.map(decorator => ({
        label: `${decorator.name}:`,
        info: `${decorator.info}. Followed by an operator.`,
        type: 'function',
        boost: -1,
        apply: insertAt(
          wrap(`${decorator.name}:`),
          quoteOffset + decorator.name.length + 1,
          true,
        ),
      })),
    ],
  };
}

function valueCompletions(
  context: CompletionContext,
  value: SyntaxNode | undefined,
  factType: string | undefined,
): CompletionResult | null {
  if (factType !== 'boolean') return null;
  if (value && value.name !== 'True' && value.name !== 'False') return null;
  const word = context.matchBefore(/\w*/);
  if (!word) return null;
  return {
    from: word.from,
    to: value?.to ?? context.pos,
    validFor: /^\w*$/,
    options: [
      { label: 'true', type: 'constant' },
      { label: 'false', type: 'constant' },
    ],
  };
}

/**
 * The keys a condition object can hold, with what each starts as: the text
 * after the colon and where the cursor goes in it.
 */
const CONDITION_KEYS: ReadonlyArray<{
  key: string;
  info: string;
  template: string;
  cursor: number;
  reopen?: boolean;
}> = [
  {
    key: 'fact',
    info: 'the fact to compare',
    template: '""',
    cursor: 1,
    reopen: true,
  },
  {
    key: 'operator',
    info: 'how to compare it',
    template: '""',
    cursor: 1,
    reopen: true,
  },
  { key: 'value', info: 'what to compare it with', template: '', cursor: 0 },
  { key: 'all', info: 'every item must pass', template: '[]', cursor: 1 },
  {
    key: 'any',
    info: 'at least one item must pass',
    template: '[]',
    cursor: 1,
  },
  { key: 'not', info: 'the item must fail', template: '{}', cursor: 1 },
];
const RULE_KEYS = [
  {
    key: 'conditions',
    info: 'the rule: one all, any or not group',
    template: '{}',
    cursor: 1,
  },
];
const LEAF_KEYS = new Set(['fact', 'operator', 'value']);
const GROUP_KEYS = new Set(['all', 'any', 'not']);

/** The property holding `object`, and the object that property is in. */
function holderOf(object: SyntaxNode) {
  const parent = object.parent;
  if (parent?.name === 'Property') return { property: parent, inArray: false };
  if (parent?.name === 'Array' && parent.parent?.name === 'Property') {
    return { property: parent.parent, inArray: true };
  }
  return undefined;
}

/** Whether `object` is the rule itself, a condition, or neither. */
function objectRole(
  state: EditorState,
  object: SyntaxNode | null,
): 'rule' | 'condition' | undefined {
  if (object?.name !== 'Object') return undefined;
  if (object.parent?.name === 'JsonText') return 'rule';
  const holder = holderOf(object);
  if (!holder) return undefined;
  const key = propertyKey(state, holder.property);
  const holderRole = objectRole(state, holder.property.parent);
  if (key === 'conditions' && !holder.inArray && holderRole === 'rule') {
    return 'condition';
  }
  if (holderRole !== 'condition') return undefined;
  if (key === 'not' && !holder.inArray) return 'condition';
  if ((key === 'all' || key === 'any') && holder.inArray) return 'condition';
  return undefined;
}

/**
 * A key the cursor is typing: inside a key's quotes, or bare in an object
 * where a key could start.
 */
function keyTarget(context: CompletionContext) {
  const { state, pos } = context;
  const node = syntaxTree(state).resolveInner(pos, -1);
  if (node.name === 'PropertyName') {
    if (pos <= node.from || pos >= node.to) return undefined;
    const property = node.parent!;
    return {
      object: property.parent,
      editing: property,
      from: node.from + 1,
      to: node.to - 1,
    };
  }
  // Between an object's members, the cursor resolves to the object, its `{`
  // or `,`, or the error node of a key typed without quotes.
  const betweenMembers =
    node.type.isError || node.name === '{' || node.name === ',';
  let object: SyntaxNode | undefined;
  if (node.name === 'Object') object = node;
  else if (betweenMembers && node.parent?.name === 'Object') {
    object = node.parent;
  }
  if (!object) return undefined;
  // With nothing typed yet, only on request, not after every `{` or `,`.
  const word = context.matchBefore(/\w*/)!;
  if (word.from === pos && !context.explicit) return undefined;
  return { object, editing: undefined, from: word.from, to: pos };
}

/**
 * Writes `"key": <template>`, or only the key when a colon already follows
 * it, and puts the cursor where the value goes.
 */
function applyKey(entry: {
  key: string;
  template: string;
  cursor: number;
  reopen?: boolean;
}) {
  return (view: EditorView, _c: Completion, from: number, to: number) => {
    const { state } = view;
    const name = syntaxTree(state).resolveInner(state.selection.main.head, -1);
    const inName = name.name === 'PropertyName';
    const start = inName ? name.from : from;
    const end = inName ? name.to : to;
    const hasColon = inName && !!name.parent?.getChild(':');
    const insert = hasColon
      ? `"${entry.key}"`
      : `"${entry.key}": ${entry.template}`;
    const cursor = hasColon
      ? insert.length
      : `"${entry.key}": `.length + entry.cursor;
    view.dispatch({
      changes: { from: start, to: end, insert },
      selection: { anchor: start + cursor },
    });
    if (entry.reopen && !hasColon) startCompletion(view);
  };
}

function keyCompletions(context: CompletionContext): CompletionResult | null {
  const target = keyTarget(context);
  if (!target) return null;
  const { state } = context;
  const role = objectRole(state, target.object);
  if (!role) return null;
  const present = new Set(
    (target.object?.getChildren('Property') ?? [])
      .filter(property => property !== target.editing)
      .map(property => propertyKey(state, property)),
  );
  let entries: ReadonlyArray<(typeof CONDITION_KEYS)[number]>;
  if (role === 'rule') {
    entries = present.has('conditions') ? [] : RULE_KEYS;
  } else if ([...present].some(key => key && GROUP_KEYS.has(key))) {
    entries = [];
  } else if ([...present].some(key => key && LEAF_KEYS.has(key))) {
    entries = CONDITION_KEYS.filter(
      e => LEAF_KEYS.has(e.key) && !present.has(e.key),
    );
  } else {
    entries = CONDITION_KEYS;
  }
  if (entries.length === 0) return null;
  return {
    from: target.from,
    to: target.to,
    validFor: /^\w*$/,
    options: entries.map(entry => ({
      label: entry.key,
      info: entry.info,
      type: 'property',
      apply: applyKey(entry),
    })),
  };
}

/**
 * Suggests the keys a condition can hold, then the chosen retrievers' facts
 * inside `"fact"`, operators inside
 * `"operator"`, and `true`/`false` inside `"value"` when the condition's
 * fact is a boolean. `getFacts` is read on every request, so the source can
 * be created once while the chosen retrievers change.
 */
export function ruleCompletionSource(
  getFacts: () => FactOption[],
): CompletionSource {
  return context => {
    const keys = keyCompletions(context);
    if (keys) return keys;
    const at = valueContextAt(context.state, context.pos);
    if (!at) return null;
    switch (at.key) {
      case 'fact':
        return factCompletions(context, at.value, getFacts());
      case 'operator':
        return operatorCompletions(context, at.value);
      case 'value': {
        const fact = siblingString(context.state, at.object, 'fact');
        const type = getFacts().find(f => f.name === fact)?.type;
        return valueCompletions(context, at.value, type);
      }
      default:
        return null;
    }
  };
}
