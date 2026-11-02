import { jsonParseLinter } from '@codemirror/lang-json';
import type { Diagnostic, LintSource } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { nodeAtPointer, propertyKey } from './jsonTree';

const parseLinter = jsonParseLinter();

/** JSON syntax errors, except that an empty filter is allowed. */
export function optionalJsonParseLinter(view: EditorView): Diagnostic[] {
  return view.state.doc.toString().trim() ? parseLinter(view) : [];
}

/**
 * The filter's shape when it sits beside the kind picker: one object, with
 * kinds left to the picker. A raw filter, which the picker can't show, may
 * be an array and may name its kinds.
 */
export function filterShapeLinter(raw: boolean): LintSource {
  return view => {
    const { state } = view;
    if (raw || !state.doc.toString().trim()) return [];
    try {
      JSON.parse(state.doc.toString());
    } catch {
      return [];
    }
    const root = nodeAtPointer(state, '');
    if (!root) return [];
    if (root.name !== 'Object') {
      return [
        {
          from: root.from,
          to: root.to,
          severity: 'error',
          message:
            'Must be a JSON object, e.g. {"spec.lifecycle": "production"}.',
        },
      ];
    }
    return root
      .getChildren('Property')
      .filter(property => propertyKey(state, property) === 'kind')
      .map(property => {
        const name = property.getChild('PropertyName')!;
        return {
          from: name.from,
          to: name.to,
          severity: 'error',
          message:
            'Set kinds with the "Entity kinds" field, not in these criteria.',
        };
      });
  };
}
