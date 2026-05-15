import { splitForCollapse } from './splitForCollapse';

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
