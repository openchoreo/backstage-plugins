import { EditorState, type TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
  formatJson,
  isFormatKey,
  mapPastWhitespace,
  prettyJson,
} from './formatJson';

/** A view stand-in that applies dispatched changes to its own state. */
function viewOf(doc: string, cursor: number) {
  const view = {
    state: EditorState.create({ doc, selection: { anchor: cursor } }),
    dispatch(spec: TransactionSpec) {
      view.state = view.state.update(spec).state;
    },
  };
  return view as typeof view & EditorView;
}

describe('prettyJson', () => {
  it('re-indents valid JSON with two spaces', () => {
    expect(prettyJson('{"all":[{"fact":"x","value":true}]}')).toBe(
      '{\n  "all": [\n    {\n      "fact": "x",\n      "value": true\n    }\n  ]\n}',
    );
  });

  it.each(['', '  ', '{"a": '])('returns undefined for %p', text => {
    expect(prettyJson(text)).toBeUndefined();
  });
});

describe('mapPastWhitespace', () => {
  it('keeps the position after the same non-whitespace characters', () => {
    const before = '{"a":   1}';
    const after = '{\n  "a": 1\n}';
    expect(after[mapPastWhitespace(before, after, before.indexOf('1'))]).toBe(
      '1',
    );
  });
});

describe('formatJson', () => {
  it('formats the document and keeps the cursor by its token', () => {
    const doc = '{"fact":"githubIsArchived","value":false}';
    const view = viewOf(doc, doc.indexOf('false'));
    expect(formatJson(view)).toBe(true);
    const text = view.state.doc.toString();
    expect(text).toBe('{\n  "fact": "githubIsArchived",\n  "value": false\n}');
    expect(text.slice(view.state.selection.main.head)).toMatch(/^false/);
  });

  it('leaves invalid JSON untouched', () => {
    const view = viewOf('{"fact": ', 3);
    expect(formatJson(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('{"fact": ');
  });
});

describe('isFormatKey', () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

  it('matches Shift+Alt+F by the physical key, whatever character it types', () => {
    expect(
      isFormatKey(
        key({ code: 'KeyF', key: 'Ï', altKey: true, shiftKey: true }),
      ),
    ).toBe(true);
  });

  it.each([
    { code: 'KeyF', key: 'f', altKey: true },
    { code: 'KeyF', key: 'F', altKey: true, shiftKey: true, metaKey: true },
    { code: 'KeyG', key: 'G', altKey: true, shiftKey: true },
  ])('ignores %p', init => {
    expect(isFormatKey(key(init))).toBe(false);
  });
});
