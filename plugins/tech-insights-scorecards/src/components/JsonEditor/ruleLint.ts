import type { Diagnostic, LintSource } from '@codemirror/lint';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import type { CheckProblem } from '../../api/types';
import {
  factValueNodes,
  nodeAtPointer,
  propertyKey,
  propertyValue,
  stringValue,
  treeOf,
} from './jsonTree';
import { LIST_FACT_TYPE, objectRole, type FactOption } from './ruleCompletions';

const LIST_DECORATORS = new Set(['everyFact', 'someFact']);

/** The index of the `]` closing the `[` at `open`, or -1. */
function closingBracket(path: string, open: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let i = open; i < path.length; i++) {
    const char = path[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = undefined;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '[') {
      depth++;
    } else if (char === ']' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

function quotedName(text: string): string | undefined {
  const match = /^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*$/.exec(
    text,
  );
  const raw = match?.[1] ?? match?.[2];
  return raw?.replace(/\\(.)/g, '$1');
}

/** The entry fields a filter expression tests with `@.name` or `@['name']`. */
function filterFields(filter: string): string[] {
  const names: string[] = [];
  // One left-to-right scan, so a quoted literal hides any `@['…']` inside it.
  const tokens =
    /@\[\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\]|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g;
  const unquoted = filter.replace(tokens, (_token, reference?: string) => {
    const name = reference === undefined ? undefined : quotedName(reference);
    if (name !== undefined) names.push(name);
    return "''";
  });
  for (const match of unquoted.matchAll(/@\.([A-Za-z_$][\w$]*)/g)) {
    names.push(match[1]);
  }
  return names;
}

/**
 * The entry fields a JSONPath over a list names: the member right after the
 * entry selector (`$[*]`, `$[?(...)]`, `$[0]`), and those the selector's
 * filter tests. Members below a field are inside its value and aren't
 * returned. A path that doesn't start by selecting entries names none.
 */
export function entryFieldsIn(path: string): string[] {
  if (!path.startsWith('$')) return [];
  const segments: Array<{ name?: string; filter?: string }> = [];
  let i = 1;
  while (i < path.length && segments.length < 2) {
    if (path.startsWith('..', i)) break;
    if (path[i] === '.') {
      const name = /^[^.[]*/.exec(path.slice(i + 1))![0];
      segments.push(name === '*' ? {} : { name });
      i += 1 + name.length;
    } else if (path[i] === '[') {
      const end = closingBracket(path, i);
      if (end < 0) break;
      const inner = path.slice(i + 1, end).trim();
      if (inner.startsWith('?')) segments.push({ filter: inner });
      else segments.push({ name: quotedName(inner) });
      i = end + 1;
    } else {
      break;
    }
  }
  const [selector, field] = segments;
  if (!selector || selector.name !== undefined) return [];
  return [
    ...(selector.filter ? filterFields(selector.filter) : []),
    ...(field?.name ? [field.name] : []),
  ];
}

function stringProperty(
  state: EditorState,
  object: SyntaxNode,
  key: string,
): { node: SyntaxNode; value: string } | undefined {
  const property = object
    .getChildren('Property')
    .filter(p => propertyKey(state, p) === key)
    .pop();
  const node = property && propertyValue(property);
  if (node?.name !== 'String') return undefined;
  const value = stringValue(state, node);
  return value === undefined ? undefined : { node, value };
}

function conditionWarnings(
  state: EditorState,
  condition: SyntaxNode,
  facts: FactOption[],
): Diagnostic[] {
  const factName = stringProperty(state, condition, 'fact')?.value;
  const fact = facts.find(f => f.name === factName);
  if (!fact) return [];
  const path = stringProperty(state, condition, 'path');
  const operator = stringProperty(state, condition, 'operator');
  const warnings: Diagnostic[] = [];

  if (path && fact.type === LIST_FACT_TYPE && fact.entries) {
    const known = Object.keys(fact.entries);
    const unknown = [
      ...new Set(entryFieldsIn(path.value).filter(n => !known.includes(n))),
    ];
    for (const name of unknown) {
      warnings.push({
        from: path.node.from,
        to: path.node.to,
        severity: 'warning',
        message: `${
          fact.name
        } entries have no field "${name}". Their fields: ${known.join(', ')}.`,
      });
    }
  }

  const decorator = operator?.value
    .split(':')
    .slice(0, -1)
    .find(part => LIST_DECORATORS.has(part));
  if (operator && decorator && !path && fact.type !== LIST_FACT_TYPE) {
    warnings.push({
      from: operator.node.from,
      to: operator.node.to,
      severity: 'warning',
      message: `${decorator} compares each item of a list, but ${fact.name} is of type ${fact.type}. Add a "path" that selects a list from it, or use a list fact.`,
    });
  }
  return warnings;
}

/**
 * Warns about conditions that build but likely don't mean what was written:
 * a `path` naming a field a list fact's entries don't have, and `everyFact:`
 * or `someFact:` on a fact that isn't a list. Warnings don't block saving.
 */
export function ruleFactLinter(getFacts: () => FactOption[]): LintSource {
  return view => {
    const { state } = view;
    const facts = getFacts();
    if (facts.length === 0) return [];
    const warnings: Diagnostic[] = [];
    treeOf(state).iterate({
      enter: ref => {
        if (ref.name !== 'Object') return;
        if (objectRole(state, ref.node) !== 'condition') return;
        warnings.push(...conditionWarnings(state, ref.node, facts));
      },
    });
    return warnings;
  };
}

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
