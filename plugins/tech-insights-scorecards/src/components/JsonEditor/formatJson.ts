import type { EditorView } from '@codemirror/view';

/** The text re-indented as two-space JSON, or undefined when it doesn't parse. */
export function prettyJson(text: string): string | undefined {
  if (!text.trim()) return undefined;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return undefined;
  }
}

/**
 * Where `pos` in `before` lands in `after`, when the two differ only in
 * whitespace: after the same number of non-whitespace characters.
 */
export function mapPastWhitespace(
  before: string,
  after: string,
  pos: number,
): number {
  let solid = 0;
  for (let i = 0; i < pos; i++) if (!/\s/.test(before[i])) solid++;
  let i = 0;
  while (i < after.length && solid > 0) {
    if (!/\s/.test(after[i])) solid--;
    i++;
  }
  // A cursor that sat on a token stays on it, past any whitespace added.
  if (pos < before.length && !/\s/.test(before[pos])) {
    while (i < after.length && /\s/.test(after[i])) i++;
  }
  return i;
}

/**
 * Re-indents the editor's JSON, keeping the cursor by the same token. Text
 * that doesn't parse is left alone; its syntax marks already say where.
 * Returns whether the text was valid JSON.
 */
export function formatJson(view: EditorView): boolean {
  const current = view.state.doc.toString();
  const pretty = prettyJson(current);
  if (pretty === undefined) return false;
  if (pretty !== current) {
    view.dispatch({
      changes: { from: 0, to: current.length, insert: pretty },
      selection: {
        anchor: mapPastWhitespace(
          current,
          pretty,
          view.state.selection.main.head,
        ),
      },
      scrollIntoView: true,
      userEvent: 'input.format',
    });
  }
  return true;
}

/**
 * Shift+Alt+F, VS Code's format key, matched on the physical key: on a Mac,
 * Option changes the character typed (Shift+Option+F types Ï), so a keymap
 * matching on the key name never sees "F".
 */
export function isFormatKey(event: KeyboardEvent): boolean {
  return (
    event.code === 'KeyF' &&
    event.altKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}
