import {
  CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import { EditorState, type TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { ruleCompletionSource, type FactOption } from './ruleCompletions';

const FACTS: FactOption[] = [
  {
    name: 'githubIsArchived',
    type: 'boolean',
    description: 'Whether the repository is archived.',
    retriever: 'githubRepositoryFactRetriever',
  },
  {
    name: 'githubOpenIssues',
    type: 'integer',
    retriever: 'githubRepositoryFactRetriever',
  },
];

const source = ruleCompletionSource(() => FACTS);

/** Completes at the `|` in `doc`. */
function complete(docWithCursor: string, explicit = true) {
  const pos = docWithCursor.indexOf('|');
  const doc = docWithCursor.replace('|', '');
  const state = EditorState.create({
    doc,
    selection: { anchor: pos },
    extensions: [json()],
  });
  const result = source(
    new CompletionContext(state, pos, explicit),
  ) as CompletionResult | null;
  return { state, result, doc, labels: result?.options.map(o => o.label) };
}

/** Applies the option labelled `label` and returns the text with a `|` cursor. */
function pick(docWithCursor: string, label: string) {
  const { state, result } = complete(docWithCursor);
  const option = result!.options.find(o => o.label === label)!;
  const view = {
    state,
    dispatch(spec: TransactionSpec) {
      view.state = view.state.update(spec).state;
    },
  };
  (option.apply as Function)(
    view as unknown as EditorView,
    option,
    result!.from,
    result!.to ?? result!.from,
  );
  const text = view.state.doc.toString();
  const head = view.state.selection.main.head;
  return `${text.slice(0, head)}|${text.slice(head)}`;
}

const inAll = (inner: string) => `{ "conditions": { "all": [ ${inner} ] } }`;

describe('ruleCompletionSource keys', () => {
  it('suggests every condition key in an empty condition', () => {
    expect(complete(inAll('{ "|" }')).labels).toEqual([
      'fact',
      'operator',
      'value',
      'all',
      'any',
      'not',
    ]);
  });

  it('suggests conditions at the top of the rule', () => {
    expect(complete('{ "|" }').labels).toEqual(['conditions']);
  });

  it('suggests only the missing parts of a fact condition', () => {
    expect(complete(inAll('{ "fact": "x", "|" }')).labels).toEqual([
      'operator',
      'value',
    ]);
  });

  it('suggests condition keys under not and any', () => {
    expect(
      complete('{ "conditions": { "any": [ { "not": { "|" } } ] } }').labels,
    ).toContain('fact');
  });

  it.each([
    ['beside a group', inAll('{ "any": [], "|" }')],
    ['inside a value', inAll('{ "fact": "x", "value": { "|" } }')],
  ])('suggests nothing %s', (_label, doc) => {
    expect(complete(doc).result).toBeNull();
  });

  it('writes the key with its value and leaves the cursor in the value', () => {
    expect(pick(inAll('{ "op|" }'), 'operator')).toBe(
      inAll('{ "operator": "|" }'),
    );
    expect(pick(inAll('{ "|" }'), 'all')).toBe(inAll('{ "all": [|] }'));
    expect(pick('{ "|" }', 'conditions')).toBe('{ "conditions": {|} }');
  });

  it('only renames a key that already has a colon', () => {
    expect(pick(inAll('{ "fa|": "x" }'), 'fact')).toBe(
      inAll('{ "fact"|: "x" }'),
    );
  });

  it('suggests keys in an empty object only when asked', () => {
    expect(complete(inAll('{ | }')).labels).toContain('fact');
    expect(complete(inAll('{ | }'), false).result).toBeNull();
    expect(pick(inAll('{ | }'), 'not')).toBe(inAll('{ "not": {|} }'));
  });
});

describe('ruleCompletionSource', () => {
  it('suggests facts inside "fact", replacing the whole string', () => {
    const { result, doc, labels } = complete('{ "fact": "git|Is" }');
    expect(labels).toEqual(['githubIsArchived', 'githubOpenIssues']);
    expect(doc.slice(result!.from, result!.to)).toBe('gitIs');
    expect(result!.options[0]).toMatchObject({
      detail: 'boolean',
      apply: 'githubIsArchived',
      info: 'Whether the repository is archived.\n\nFrom githubRepositoryFactRetriever.',
    });
  });

  it('adds quotes when "fact" has no value yet', () => {
    const { result } = complete('{ "fact": | }');
    expect(result!.options[0].apply).toBe('"githubIsArchived"');
  });

  it('suggests operators and decorators inside "operator"', () => {
    const { labels } = complete('{ "fact": "x", "operator": "|" }');
    expect(labels).toEqual(
      expect.arrayContaining(['equal', 'contains', 'not:', 'everyFact:']),
    );
    expect(labels).toHaveLength(16);
  });

  it('completes the operator after a decorator', () => {
    const { result, doc } = complete('{ "operator": "not:eq|" }');
    expect(doc.slice(result!.from, result!.to)).toBe('eq');
  });

  it('suggests true and false for a boolean fact', () => {
    const { labels } = complete(
      '{ "fact": "githubIsArchived", "operator": "equal", "value": | }',
    );
    expect(labels).toEqual(['true', 'false']);
  });

  it.each([
    [
      'for a non-boolean fact',
      '{ "fact": "githubOpenIssues", "operator": "equal", "value": | }',
    ],
    ['in another property', '{ "name": "|" }'],
  ])('suggests nothing %s', (_label, doc) => {
    expect(complete(doc).result).toBeNull();
  });
});
