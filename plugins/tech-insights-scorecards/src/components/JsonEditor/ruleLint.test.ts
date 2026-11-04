import type { Diagnostic } from '@codemirror/lint';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { CheckProblem } from '../../api/types';
import { problemDiagnostics, serverRuleLinter } from './ruleLint';

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

  it('skips the request while the JSON does not parse', async () => {
    const validate = jest.fn();
    await expect(
      serverRuleLinter(validate)(viewOf('{ "a": ')),
    ).resolves.toEqual([]);
    expect(validate).not.toHaveBeenCalled();
  });

  it('reports nothing when validation fails or is unavailable', async () => {
    const view = viewOf(RULE);
    await expect(
      serverRuleLinter(() => Promise.reject(new Error('503')))(view),
    ).resolves.toEqual([]);
    await expect(
      serverRuleLinter(async () => undefined)(view),
    ).resolves.toEqual([]);
  });

  it('answers an older run with the newest result', async () => {
    const resolvers: Array<(problems: CheckProblem[]) => void> = [];
    const lint = serverRuleLinter(
      () => new Promise(resolve => resolvers.push(resolve)),
    );
    const view = viewOf(RULE);
    const older = lint(view) as Promise<Diagnostic[]>;
    const newer = lint(view) as Promise<Diagnostic[]>;
    await Promise.resolve();
    resolvers[1]([problem]);
    resolvers[0]([]);
    await expect(newer).resolves.toHaveLength(1);
    await expect(older).resolves.toHaveLength(1);
  });
});
