import type { Diagnostic } from '@codemirror/lint';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { filterShapeLinter, optionalJsonParseLinter } from './filterLint';

function viewOf(doc: string) {
  return {
    state: EditorState.create({ doc, extensions: [json()] }),
  } as unknown as EditorView;
}

function marks(doc: string, raw = false) {
  const view = viewOf(doc);
  return (filterShapeLinter(raw)(view) as Diagnostic[]).map(d => ({
    text: doc.slice(d.from, d.to),
    message: d.message,
  }));
}

describe('optionalJsonParseLinter', () => {
  it('allows an empty filter', () => {
    expect(optionalJsonParseLinter(viewOf('  '))).toEqual([]);
  });

  it('marks invalid JSON', () => {
    expect(optionalJsonParseLinter(viewOf('{ "a": '))).toHaveLength(1);
  });
});

describe('filterShapeLinter', () => {
  it('marks a kind key, pointing to the kind picker', () => {
    expect(marks('{ "kind": "API", "spec.type": "openapi" }')).toEqual([
      {
        text: '"kind"',
        message:
          'Set kinds with the "Entity kinds" field, not in these criteria.',
      },
    ]);
  });

  it('marks a filter that is not an object', () => {
    expect(marks('[{ "spec.type": "service" }]')).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/JSON object/),
      }),
    ]);
  });

  it('accepts a plain object, an empty filter and invalid JSON', () => {
    expect(marks('{ "spec.type": "service" }')).toEqual([]);
    expect(marks('')).toEqual([]);
    expect(marks('{ "kind": ')).toEqual([]);
  });

  it('lets a raw filter be an array and name its kinds', () => {
    expect(marks('[{ "kind": "Component" }, { "kind": "API" }]', true)).toEqual(
      [],
    );
  });
});
