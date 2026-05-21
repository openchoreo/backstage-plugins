/**
 * Split an assistant message into a "summary" (diagnosis + next action)
 * and a "details" block (evidence + trace bridge) so the drawer can
 * hide the latter behind a ``<details>`` expander.
 *
 * The perch-agent prompt today emits a few different shapes:
 *
 *   - runtime_debug:   diagnosis → Evidence → Trace bridge → Next action
 *   - build_failure:   What happened → Evidence → What to do
 *   - partial data:    diagnosis → What I saw → Next action / What to do
 *   - fully empty:     diagnosis → What I checked → Next action / What to do
 *
 * We split on the FIRST opening marker (one of Evidence / What I saw /
 * What I checked) and re-stitch everything before it together with
 * everything from the FIRST closing marker (one of Next action /
 * What to do) onwards. Anything in between goes into ``details``.
 *
 * If either marker is missing, the message is returned untouched —
 * partial / off-pattern responses render normally rather than risk
 * hiding the wrong section.
 */
export type SplitResult = { summary: string; details?: string };

// Matched on a line of its own (with optional ``**`` markdown bold).
// Trailing colon is optional because some model outputs write
// "Evidence" / "Evidence:" / "**Evidence**" interchangeably.
const OPEN_RE =
  /^\s*(?:\*\*)?(?:Evidence|What I saw|What I checked)(?:\*\*)?\s*:?\s*$/im;
const CLOSE_RE = /^\s*(?:\*\*)?(?:Next action|What to do)(?:\*\*)?\s*:?/im;

export function splitForCollapse(text: string): SplitResult {
  const openMatch = OPEN_RE.exec(text);
  if (!openMatch || openMatch.index === undefined) {
    return { summary: text };
  }
  // Look for the closer only AFTER the opener — otherwise a message
  // whose diagnosis sentence happens to contain "next action" earlier
  // in the text would split nonsensically.
  const tail = text.slice(openMatch.index);
  const closeMatch = CLOSE_RE.exec(tail);
  if (!closeMatch || closeMatch.index === undefined) {
    return { summary: text };
  }

  const cutStart = openMatch.index;
  const cutEnd = openMatch.index + closeMatch.index;
  const before = text.slice(0, cutStart).trimEnd();
  const middle = text.slice(cutStart, cutEnd).trim();
  const after = text.slice(cutEnd).trimStart();

  // Don't bother collapsing a near-empty middle — adds UI clutter
  // (a "Show details" link that reveals 30 chars) for no payoff.
  // The threshold is a heuristic; one bullet of evidence is ~80 chars
  // and is the smallest case worth collapsing.
  if (middle.length < 60) {
    return { summary: text };
  }

  const summary = before && after ? `${before}\n\n${after}` : before || after;
  return { summary, details: middle };
}

/**
 * Streaming-time variant of {@link splitForCollapse}. The full-message
 * version waits for BOTH the opener and the closer before splitting; if
 * we used it during streaming, the Evidence section would render
 * verbatim as tokens arrive and then ABRUPTLY collapse behind
 * "Show details" the moment the closer landed — visible content
 * disappearing under the user's cursor.
 *
 * This variant hides post-opener content as soon as the opener is seen.
 * Once the closer also arrives, the post-closer text appends to the
 * visible summary. The user sees the same shape they'll see in the
 * timeline after ``done``, so the transition is silent.
 *
 * Identical to ``splitForCollapse`` when:
 *   - No opener has streamed yet (full text returned).
 *   - The closer arrives and the middle is large enough that
 *     ``splitForCollapse`` would have split (returns the same summary).
 *
 * Diverges when:
 *   - Opener present, closer not yet → hide everything from the opener
 *     onwards (``splitForCollapse`` returns full text in this case).
 *   - Both markers present but middle is < 60 chars → still hide the
 *     evidence; the timeline will reveal it after ``done`` because
 *     ``splitForCollapse``'s 60-char threshold kicks in, which is a
 *     gentle reveal of <60 chars, not a flicker of disappearing text.
 */
export function splitForStreaming(text: string): { summary: string } {
  const openMatch = OPEN_RE.exec(text);
  if (!openMatch || openMatch.index === undefined) {
    return { summary: text };
  }
  const tail = text.slice(openMatch.index);
  const closeMatch = CLOSE_RE.exec(tail);
  const before = text.slice(0, openMatch.index).trimEnd();
  if (!closeMatch || closeMatch.index === undefined) {
    return { summary: before };
  }
  const cutEnd = openMatch.index + closeMatch.index;
  const after = text.slice(cutEnd).trimStart();
  const summary = before && after ? `${before}\n\n${after}` : before || after;
  return { summary };
}
