import { splitForCollapse, splitForStreaming } from './splitForCollapse';

describe('splitForCollapse', () => {
  it('splits a runtime_debug response on Evidence … Next action', () => {
    // Real-world shape captured from a perch chat; the diagnosis +
    // next action are the actionable bits, evidence is supporting data.
    const msg = [
      'Root cause: lab-auth-service is intentionally injecting failures on /api/auth/verify, returning 500s that lab-api-service surfaces.',
      '',
      'Evidence',
      '',
      '- lab-api-service at 04:55:09 — "auth call non-2xx ... status=500"',
      '- lab-api-service at 04:55:09 — "auth verify failed ..."',
      'Trace bridge: trace_id=abc appears in the 04:55:09 error.',
      '',
      'Next action: disable the failure injection on lab-auth-service.',
    ].join('\n');

    const { summary, details } = splitForCollapse(msg);

    expect(summary).toContain('Root cause: lab-auth-service');
    expect(summary).toContain('Next action: disable');
    expect(summary).not.toContain('Evidence');
    expect(summary).not.toContain('Trace bridge');
    expect(details).toBeDefined();
    expect(details).toContain('Evidence');
    expect(details).toContain('Trace bridge');
    expect(details).toContain('auth call non-2xx');
  });

  it('splits a build_failure response on Evidence … What to do', () => {
    // build_failure responses use "What to do" instead of "Next action".
    // The closer regex matches both — if this test breaks, the build
    // failure path silently regresses to showing everything inline.
    const msg = [
      '**What happened**',
      'The `publish-image` step failed with manifest unknown — the destination registry rejected the tag.',
      '',
      '**Evidence**',
      '- `publish-image` at 10:42:13 — "denied: requested access to the resource is denied"',
      '- `publish-image` at 10:42:14 — "manifest unknown: manifest unknown"',
      '',
      '**What to do**',
      '- Verify the imagePullSecrets / registry credentials referenced by the workflow.',
    ].join('\n');

    const { summary, details } = splitForCollapse(msg);

    expect(summary).toContain('What happened');
    expect(summary).toContain('What to do');
    expect(summary).not.toContain('Evidence');
    expect(details).toContain('Evidence');
    expect(details).toContain('manifest unknown');
  });

  it('handles the "What I saw" partial-data variant', () => {
    // The build_failure prompt swaps "Evidence" for "What I saw" when
    // the logs/events returned data but no clear smoking gun.
    const msg = [
      '**What happened**',
      'The `build` step failed but no specific error surfaced in the logs or events.',
      '',
      '**What I saw**',
      '- Pod logs ended cleanly at step `build` with no exit code',
      '- Pod events show no OOMKilled / FailedScheduling — pod completed normally',
      '- Archived logs were empty',
      '',
      '**What to do**',
      '- Re-run the build and watch a live tail; pod may have been GCd before logs were captured.',
    ].join('\n');

    const { summary, details } = splitForCollapse(msg);

    expect(summary).toContain('What happened');
    expect(summary).toContain('What to do');
    expect(summary).not.toContain('What I saw');
    expect(details).toContain('What I saw');
    expect(details).toContain('OOMKilled');
  });

  it('returns the original text when the Evidence marker is missing', () => {
    // Off-pattern responses (e.g. polite decline, scope-clarification
    // questions, run-not-found stubs) must render inline — collapsing
    // them would hide content with no detail block to put it in.
    const msg =
      'I could not find that workflow run in namespace `default`. Verify the run name and try again.';
    const result = splitForCollapse(msg);
    expect(result).toEqual({ summary: msg });
  });

  it('returns the original text when the closing marker is missing', () => {
    // Partial-stream output or a malformed response that opens an
    // Evidence section without ever emitting a "Next action" / "What
    // to do" closer must NOT collapse — we'd otherwise hide everything
    // from "Evidence" through end-of-message, making the response
    // visually empty.
    const msg = [
      'Diagnosis: something happened.',
      '',
      'Evidence',
      '- bullet one',
      '- bullet two',
    ].join('\n');
    const result = splitForCollapse(msg);
    expect(result).toEqual({ summary: msg });
  });

  it('does not collapse a near-empty evidence block', () => {
    // A "Show details" expander that reveals 30 chars is UI noise —
    // the threshold (60 chars) is a heuristic and this test pins it.
    // If you raise/lower the threshold, update the fixture accordingly.
    const msg = [
      'Diagnosis.',
      '',
      'Evidence',
      'tiny.',
      '',
      'Next action: do the thing.',
    ].join('\n');
    const result = splitForCollapse(msg);
    expect(result.details).toBeUndefined();
    expect(result.summary).toBe(msg);
  });

  // Why these tests exist: if the streaming-time hider stopped working,
  // the chat drawer would re-introduce the flash-then-collapse flicker
  // — Evidence content streams in, then snaps under "Show details" the
  // moment ``done`` lands. The visible jump is jarring; preserving the
  // streaming/timeline-shape equivalence is the goal these pin down.

  describe('splitForStreaming', () => {
    it('returns the full text when no Evidence opener has streamed', () => {
      // Early-stream state: the model is still writing the diagnosis. We
      // want every token visible — there's nothing to hide yet.
      const msg = '**What happened**\n\nThe build failed in `checkout-source`.';
      expect(splitForStreaming(msg)).toEqual({ summary: msg });
    });

    it('hides everything from the opener onwards while the closer is still pending', () => {
      // Mid-stream: opener landed, closer hasn't yet. Without this hider
      // the user would see the Evidence section render, then disappear
      // a beat later when the closer arrives and splitForCollapse splits.
      const msg = [
        '**What happened**',
        'Diagnosis sentence.',
        '',
        '**Evidence**',
        '- partial bullet that is currently arriving token-by-token',
      ].join('\n');
      const { summary } = splitForStreaming(msg);
      expect(summary).toContain('What happened');
      expect(summary).toContain('Diagnosis sentence');
      expect(summary).not.toContain('Evidence');
      expect(summary).not.toContain('partial bullet');
    });

    it('matches the timeline summary once both markers are present', () => {
      // End-of-stream state: both markers in place. The streaming render
      // and the final timeline render must show identical content so the
      // ``done`` transition is silent.
      const msg = [
        '**What happened**',
        'Build failed in checkout-source.',
        '',
        '**Evidence**',
        '- `checkout-source` at 10:42:13 — "exit status 1; cannot save parameter /tmp/x"',
        '- `checkout-source` at 10:42:13 — "no such file or directory"',
        '',
        '**What to do**',
        '- Re-run the build; if it repeats, inspect the checkout image setup.',
      ].join('\n');
      const stream = splitForStreaming(msg).summary;
      const final = splitForCollapse(msg).summary;
      expect(stream).toBe(final);
    });

    it('hides Evidence even for tiny middles, to avoid an end-of-stream reveal flicker', () => {
      // splitForCollapse keeps near-empty Evidence inline (>=60 char cap
      // is intentional UI clutter avoidance). The streaming variant
      // hides it anyway — a brief reveal of <60 chars after done is much
      // less jarring than a flash-then-collapse during streaming.
      const msg = [
        'Diagnosis.',
        '',
        'Evidence',
        'tiny.',
        '',
        'Next action: do the thing.',
      ].join('\n');
      const { summary } = splitForStreaming(msg);
      expect(summary).not.toContain('Evidence');
      expect(summary).not.toContain('tiny');
      expect(summary).toContain('Next action');
    });
  });

  it('matches the Evidence marker case-insensitively', () => {
    // The model occasionally emits "evidence" / "EVIDENCE" instead of
    // the prescribed "Evidence". Case-insensitivity prevents minor
    // capitalisation drift from disabling the feature.
    const msg = [
      'Root cause: something.',
      '',
      'evidence',
      '',
      '- a long bullet describing what we saw in the logs',
      '- another long bullet expanding the picture for the reader',
      '',
      'next action: do the thing and ensure it stays done.',
    ].join('\n');
    const result = splitForCollapse(msg);
    expect(result.details).toBeDefined();
    expect(result.details).toContain('long bullet');
  });
});
