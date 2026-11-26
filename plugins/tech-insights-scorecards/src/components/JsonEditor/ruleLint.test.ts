import type { Diagnostic } from '@codemirror/lint';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { CheckProblem } from '../../api/types';
import type { FactOption } from './ruleCompletions';
import {
  entryFieldsIn,
  problemDiagnostics,
  ruleFactLinter,
  serverRuleLinter,
} from './ruleLint';

const RULE = `{
  "conditions": {
    "all": [
      { "fact": "isArchived", "operator": "equals", "value": false },
      { "fact": "isArchived", "operator": "equal", "value": true }
    ]
  }
}`;

const state = EditorState.create({ doc: RULE, extensions: [json()] });
const marked = (diagnostics: Diagnostic[]) =>
  diagnostics.map(d => state.sliceDoc(d.from, d.to));

describe('problemDiagnostics', () => {
  it('marks an invalid condition at its path', () => {
    const diagnostics = problemDiagnostics(state, [
      {
        code: 'invalid-rule',
        path: '/conditions/all/0',
        message: 'Unknown operator: equals',
      },
    ]);
    expect(marked(diagnostics)).toEqual([
      '{ "fact": "isArchived", "operator": "equals", "value": false }',
    ]);
    expect(diagnostics[0]).toMatchObject({
      severity: 'error',
      message: 'Unknown operator: equals',
    });
  });

  it('marks every use of an unknown fact', () => {
    const diagnostics = problemDiagnostics(state, [
      { code: 'unknown-fact', fact: 'isArchived', message: 'Unknown fact.' },
    ]);
    expect(marked(diagnostics)).toEqual(['"isArchived"', '"isArchived"']);
  });

  it('marks the whole rule when the path is no longer in the text', () => {
    const diagnostics = problemDiagnostics(state, [
      { code: 'invalid-rule', path: '/conditions/any/3', message: 'Bad.' },
    ]);
    expect(diagnostics).toEqual([
      expect.objectContaining({ from: 0, to: RULE.length }),
    ]);
  });

  it('leaves retriever problems to the retriever field', () => {
    expect(
      problemDiagnostics(state, [
        { code: 'unknown-retriever', message: 'No such retriever.' },
      ]),
    ).toEqual([]);
  });
});

describe('serverRuleLinter', () => {
  const viewOf = (doc: string) =>
    ({
      state: EditorState.create({ doc, extensions: [json()] }),
    } as unknown as EditorView);
  const problem: CheckProblem = {
    code: 'invalid-rule',
    path: '/conditions/all/0',
    message: 'Unknown operator: equals',
  };
  const noInputs = () => '';

  it('skips the request while the JSON does not parse', async () => {
    const validate = jest.fn();
    await expect(
      serverRuleLinter(validate, noInputs)(viewOf('{ "a": ')),
    ).resolves.toEqual([]);
    expect(validate).not.toHaveBeenCalled();
  });

  it('reports nothing when validation fails or is unavailable', async () => {
    const view = viewOf(RULE);
    await expect(
      serverRuleLinter(() => Promise.reject(new Error('503')), noInputs)(view),
    ).resolves.toEqual([]);
    await expect(
      serverRuleLinter(async () => undefined, noInputs)(view),
    ).resolves.toEqual([]);
  });

  it('answers an older run with the newest result', async () => {
    const resolvers: Array<(problems: CheckProblem[]) => void> = [];
    let retrievers = 'repoFacts';
    const lint = serverRuleLinter(
      () => new Promise(resolve => resolvers.push(resolve)),
      () => retrievers,
    );
    const view = viewOf(RULE);
    const older = lint(view) as Promise<Diagnostic[]>;
    retrievers = 'repoFacts\nciFacts';
    const newer = lint(view) as Promise<Diagnostic[]>;
    await Promise.resolve();
    resolvers[1]([problem]);
    resolvers[0]([]);
    await expect(newer).resolves.toHaveLength(1);
    await expect(older).resolves.toHaveLength(1);
  });

  it('answers a run that reused a pending request with the newest result', async () => {
    const resolvers: Array<(problems: CheckProblem[]) => void> = [];
    let retrievers = 'repoFacts';
    const lint = serverRuleLinter(
      () => new Promise(resolve => resolvers.push(resolve)),
      () => retrievers,
    );
    const view = viewOf(RULE);
    const first = lint(view) as Promise<Diagnostic[]>;
    const reused = lint(view) as Promise<Diagnostic[]>;
    retrievers = 'repoFacts\nciFacts';
    const newer = lint(view) as Promise<Diagnostic[]>;
    await Promise.resolve();
    expect(resolvers).toHaveLength(2);
    resolvers[1]([problem]);
    resolvers[0]([]);
    await expect(newer).resolves.toHaveLength(1);
    await expect(reused).resolves.toHaveLength(1);
    await expect(first).resolves.toHaveLength(1);
  });

  it('asks again only when the document or its inputs change', async () => {
    const validate = jest.fn(async () => [problem]);
    let inputs = 'repoFacts';
    const lint = serverRuleLinter(validate, () => inputs);

    await expect(lint(viewOf(RULE))).resolves.toHaveLength(1);
    await expect(lint(viewOf(RULE))).resolves.toHaveLength(1);
    expect(validate).toHaveBeenCalledTimes(1);

    await lint(viewOf(`${RULE} `));
    expect(validate).toHaveBeenCalledTimes(2);

    inputs = 'repoFacts\nciFacts';
    await lint(viewOf(`${RULE} `));
    expect(validate).toHaveBeenCalledTimes(3);
  });

  it('retries a request that failed', async () => {
    const validate = jest
      .fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue([problem]);
    const lint = serverRuleLinter(validate, noInputs);

    await expect(lint(viewOf(RULE))).resolves.toEqual([]);
    await expect(lint(viewOf(RULE))).resolves.toHaveLength(1);
    expect(validate).toHaveBeenCalledTimes(2);
  });
});

describe('entryFieldsIn', () => {
  it.each([
    ['$[*].healthy', ['healthy']],
    ['$[?(@.primary)].healthy', ['primary', 'healthy']],
    [
      "$[?(@.name=='a' && @.replicas > 1)].healthy",
      ['name', 'replicas', 'healthy'],
    ],
    ["$[?(@['zone-id']=='x')]['zone-id']", ['zone-id', 'zone-id']],
    ["$[?(@.name=='@.other')].healthy", ['name', 'healthy']],
    [`$[?(@.name == "@['ghost']")].healthy`, ['name', 'healthy']],
    [`$[?(@['zone-id'] == "@['ghost']")].healthy`, ['zone-id', 'healthy']],
    ['$[0].labels.team', ['labels']],
    ['$[*]', []],
    ['$..healthy', []],
    ['$.length', []],
    ['healthy', []],
  ])('reads %s', (path, fields) => {
    expect(entryFieldsIn(path)).toEqual(fields);
  });
});

describe('ruleFactLinter', () => {
  const facts: FactOption[] = [
    {
      name: 'shards',
      type: 'set',
      retriever: 'storageFactRetriever',
      entries: {
        name: { type: 'string' },
        primary: { type: 'boolean' },
        healthy: { type: 'boolean' },
      },
    },
    { name: 'tags', type: 'set', retriever: 'storageFactRetriever' },
    { name: 'openIssues', type: 'integer', retriever: 'repoFactRetriever' },
  ];
  const lint = (conditions: unknown[]) => {
    const doc = JSON.stringify({ conditions: { all: conditions } }, null, 2);
    const view = {
      state: EditorState.create({ doc, extensions: [json()] }),
    } as unknown as EditorView;
    const diagnostics = ruleFactLinter(() => facts)(view) as Diagnostic[];
    return diagnostics.map(d => ({
      at: view.state.sliceDoc(d.from, d.to),
      severity: d.severity,
      message: d.message,
    }));
  };

  it('warns about a path naming a field the entries do not have', () => {
    expect(
      lint([
        {
          fact: 'shards',
          path: '$[?(@.primery)].healthy',
          operator: 'everyFact:equal',
          value: true,
        },
      ]),
    ).toEqual([
      {
        at: '"$[?(@.primery)].healthy"',
        severity: 'warning',
        message:
          'shards entries have no field "primery". Their fields: name, primary, healthy.',
      },
    ]);
  });

  it.each([
    [
      'a path over known fields',
      {
        fact: 'shards',
        path: '$[?(@.primary)].healthy',
        operator: 'everyFact:equal',
        value: true,
      },
    ],
    [
      'a list fact without declared entries',
      {
        fact: 'tags',
        path: '$[*].anything',
        operator: 'someFact:equal',
        value: 'x',
      },
    ],
    [
      'everyFact on a list fact',
      { fact: 'tags', operator: 'everyFact:notEqual', value: '' },
    ],
    [
      'everyFact with a path',
      {
        fact: 'openIssues',
        path: '$.items',
        operator: 'everyFact:equal',
        value: 1,
      },
    ],
    [
      'a fact no chosen retriever has',
      { fact: 'unknown', operator: 'everyFact:equal', value: 1 },
    ],
    ['a plain operator', { fact: 'openIssues', operator: 'equal', value: 0 }],
  ])('does not warn about %s', (_label, condition) => {
    expect(lint([condition])).toEqual([]);
  });

  it.each(['everyFact:equal', 'not:someFact:equal'])(
    'warns about %s on a fact that is not a list',
    operator => {
      expect(lint([{ fact: 'openIssues', operator, value: 0 }])).toEqual([
        expect.objectContaining({
          at: JSON.stringify(operator),
          severity: 'warning',
          message: expect.stringContaining('openIssues is of type integer'),
        }),
      ]);
    },
  );

  it('checks conditions inside nested groups only', () => {
    expect(
      lint([
        {
          any: [
            {
              not: {
                fact: 'shards',
                path: '$[*].helthy',
                operator: 'everyFact:equal',
                value: true,
              },
            },
          ],
        },
        {
          fact: 'openIssues',
          operator: 'equal',
          value: { fact: 'shards', path: '$[*].nope' },
        },
      ]).map(d => d.at),
    ).toEqual(['"$[*].helthy"']);
  });
});
