import type { Diagnostic, LintSource } from '@codemirror/lint';
import type { EditorState } from '@codemirror/state';
import type { CheckProblem } from '../../api/types';
import { factValueNodes, nodeAtPointer } from './jsonTree';

/**
 * Places the validator's problems in the rule: an invalid condition at the
 * node its pointer names, an unknown fact at every place it's used. Problems
 * about the chosen retrievers belong to that field, not the rule.
 */
export function problemDiagnostics(
  state: EditorState,
  problems: CheckProblem[],
): Diagnostic[] {
  return problems.flatMap(problem => {
    if (problem.code === 'unknown-retriever') return [];
    const nodes =
      problem.code === 'unknown-fact' && problem.fact !== undefined
        ? factValueNodes(state, problem.fact)
        : [nodeAtPointer(state, problem.path ?? '')].filter(
            node => node !== undefined,
          );
    const ranges =
      nodes.length > 0 ? nodes : [{ from: 0, to: state.doc.length }];
    return ranges.map(({ from, to }) => ({
      from,
      to,
      severity: 'error' as const,
      message: problem.message,
    }));
  });
}

/**
 * Lints the rule with the backend's validator. `validate` returns undefined
 * when there is nothing to report, e.g. while the backend can't validate.
 *
 * CodeMirror drops a result only when the document has changed since the
 * lint started. A slower, older request can still resolve after a newer one
 * for the same document (after the chosen retrievers change), so every run
 * answers with the newest one's result.
 */
export function serverRuleLinter(
  validate: (rule: unknown) => Promise<CheckProblem[] | undefined>,
): LintSource {
  let latest: Promise<Diagnostic[]> | undefined;
  return view => {
    const { state } = view;
    const run = (async () => {
      let rule: unknown;
      try {
        rule = JSON.parse(state.doc.toString());
      } catch {
        return [];
      }
      const problems = await validate(rule).catch(() => undefined);
      return problems ? problemDiagnostics(state, problems) : [];
    })();
    latest = run;
    return run.then(result => (latest === run ? result : latest!));
  };
}
