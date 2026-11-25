import {
  CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import { EditorState, type TransactionSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
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

const SHARDS: FactOption = {
  name: 'shards',
  type: 'set',
  description: 'One entry per shard.',
  retriever: 'storageFactRetriever',
  entries: {
    name: { type: 'string', description: 'The shard name.' },
    primary: { type: 'boolean' },
    healthy: { type: 'boolean', description: 'Whether the shard is healthy.' },
    replicas: { type: 'integer', description: 'Running replicas.' },
  },
};

const TAGS: FactOption = {
  name: 'tags',
  type: 'set',
  retriever: 'storageFactRetriever',
};

const source = ruleCompletionSource(() => FACTS);
const listSource = ruleCompletionSource(() => [...FACTS, SHARDS, TAGS]);

/** Completes at the `|` in `doc`. */
function complete(docWithCursor: string, explicit = true, from = source) {
  const pos = docWithCursor.indexOf('|');
  const doc = docWithCursor.replace('|', '');
  const state = EditorState.create({
    doc,
    selection: { anchor: pos },
    extensions: [json()],
  });
  const result = from(
    new CompletionContext(state, pos, explicit),
  ) as CompletionResult | null;
  return { state, result, doc, labels: result?.options.map(o => o.label) };
}

/** Applies the option labelled `label` and returns the text with a `|` cursor. */
function pick(docWithCursor: string, label: string, from = source) {
  const { state, result } = complete(docWithCursor, true, from);
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

  it('suggests path beside a list fact', () => {
    expect(
      complete(inAll('{ "fact": "shards", "|" }'), true, listSource).labels,
    ).toEqual(['operator', 'value', 'path']);
    expect(pick(inAll('{ "fact": "shards", "pa|" }'), 'path', listSource)).toBe(
      inAll('{ "fact": "shards", "path": "|" }'),
    );
  });

  it.each([
    ['a fact that is not a list', '{ "fact": "githubOpenIssues", "|" }'],
    ['a condition that has one', '{ "fact": "shards", "path": "$", "|" }'],
  ])('does not suggest path beside %s', (_label, condition) => {
    expect(complete(inAll(condition), true, listSource).labels).not.toContain(
      'path',
    );
  });

  it('treats path as part of a fact condition', () => {
    expect(
      complete(inAll('{ "path": "$", "|" }'), true, listSource).labels,
    ).toEqual(['fact', 'operator', 'value']);
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

describe('ruleCompletionSource path', () => {
  it('suggests every field and the fields of entries a boolean field selects', () => {
    const { labels } = complete(
      '{ "fact": "shards", "path": "|" }',
      true,
      listSource,
    );
    expect(labels).toEqual([
      '$[*].name',
      '$[*].primary',
      '$[*].healthy',
      '$[*].replicas',
      '$[?(@.primary)].name',
      '$[?(@.primary)].healthy',
      '$[?(@.primary)].replicas',
      '$[?(@.healthy)].name',
      '$[?(@.healthy)].primary',
      '$[?(@.healthy)].replicas',
      "$[?(@.field=='value')].field",
    ]);
  });

  it("shows the field's type and description", () => {
    const { result } = complete(
      '{ "fact": "shards", "path": "|" }',
      true,
      listSource,
    );
    const option = (label: string) =>
      result!.options.find(o => o.label === label);
    expect(option('$[*].replicas')).toMatchObject({
      detail: 'integer',
      info: 'replicas of every entry.\n\nRunning replicas.',
    });
    expect(option('$[?(@.primary)].healthy')).toMatchObject({
      detail: 'boolean',
      info: 'healthy of the entries where primary is true.\n\nWhether the shard is healthy.',
    });
  });

  it('replaces the whole path, adding quotes when there is no value yet', () => {
    const { result, doc } = complete(
      '{ "fact": "shards", "path": "$[*].na|me" }',
      true,
      listSource,
    );
    expect(doc.slice(result!.from, result!.to)).toBe('$[*].name');
    const unquoted = complete(
      '{ "fact": "shards", "path": | }',
      true,
      listSource,
    );
    expect(unquoted.result!.options[0].apply).toBe('"$[*].name"');
  });

  it('inserts the filter snippet with its fields to fill in', () => {
    const { state, result } = complete(
      '{ "fact": "shards", "path": "|" }',
      true,
      listSource,
    );
    const option = result!.options.find(o => o.label.includes("=='value'"))!;
    const view = new EditorView({ state, parent: document.body });
    (option.apply as Function)(view, option, result!.from, result!.to);
    expect(view.state.doc.toString()).toBe(
      `{ "fact": "shards", "path": "$[?(@.field=='value')].field" }`,
    );
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe('field');
    view.destroy();
  });

  it('uses bracket notation for a field that is not a plain name', () => {
    const zones = ruleCompletionSource(() => [
      {
        ...SHARDS,
        entries: {
          'zone-id': { type: 'string' },
          primary: { type: 'boolean' },
        },
      },
    ]);
    expect(
      complete('{ "fact": "shards", "path": "|" }', true, zones).labels,
    ).toEqual(
      expect.arrayContaining(["$[*]['zone-id']", "$[?(@.primary)]['zone-id']"]),
    );
  });

  it('escapes a field name for the JSON string it goes into', () => {
    const quoted = ruleCompletionSource(() => [
      { ...SHARDS, entries: { 'display"name': { type: 'string' } } },
    ]);
    const label = `$[*]['display"name']`;
    const inString = complete(
      '{ "fact": "shards", "path": "|" }',
      true,
      quoted,
    );
    expect(inString.result!.options[0].apply).toBe(`$[*]['display\\"name']`);
    const unquoted = complete('{ "fact": "shards", "path": | }', true, quoted);
    expect(unquoted.result!.options[0].apply).toBe(JSON.stringify(label));
  });

  it.each([
    ['a list fact without declared entries', '{ "fact": "tags", "path": "|" }'],
    [
      'a fact that is not a list',
      '{ "fact": "githubOpenIssues", "path": "|" }',
    ],
    ['a condition without a fact', '{ "path": "|" }'],
  ])('suggests nothing for %s', (_label, doc) => {
    expect(complete(doc, true, listSource).result).toBeNull();
  });
});
