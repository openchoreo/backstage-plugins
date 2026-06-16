const TERMINAL_STATUSES = ['completed', 'failed', 'succeeded', 'error'];

/**
 * True when a workflow run's overall status has reached a terminal phase
 * (succeeded, failed, completed, error). Used by polling effects to decide
 * when to stop refetching.
 */
export function isTerminalStatus(status?: string): boolean {
  return status ? TERMINAL_STATUSES.includes(status.toLowerCase()) : false;
}

/**
 * True when a specific step is actively running AND the surrounding workflow
 * isn't itself terminal. Used by log/event tabs to decide whether to keep
 * polling for new rows and to tail the viewport. Structurally typed so it
 * accepts any step shape (the bff-type, the workflows-plugin local type,
 * etc.) as long as it carries a `phase` field.
 */
export function isStepLive(
  step: { phase?: string } | undefined,
  parentStatus?: string,
): boolean {
  return (
    step?.phase?.toLowerCase() === 'running' && !isTerminalStatus(parentStatus)
  );
}
