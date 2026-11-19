import type { EndpointFollowResult } from '@openchoreo/backstage-plugin-common';

function list(names: string[]): string {
  return names.join(', ');
}

/**
 * Says how a component's Endpoints followed it, after the component's own
 * message, e.g. "Endpoints promoted: orders-api." An Endpoint that didn't
 * follow is named with why, and the message is then an error, since the
 * user should repeat the action. Undefined when the component owns no
 * Endpoints on the line.
 */
export function endpointFollowMessage(
  result: EndpointFollowResult | undefined,
  verb: string,
): { text: string; failed: boolean } | undefined {
  if (!result) return undefined;
  const parts: string[] = [];
  if (result.bound.length > 0) {
    parts.push(
      `Endpoints ${verb}: ${list(result.bound.map(b => b.endpoint))}.`,
    );
  }
  if (result.removed.length > 0) {
    parts.push(`Endpoints removed: ${list(result.removed)}.`);
  }
  if (result.skipped.length > 0) {
    parts.push(`Endpoints deployed automatically: ${list(result.skipped)}.`);
  }
  if (result.failed.length > 0) {
    const failures = result.failed.map(f =>
      f.endpoint ? `${f.endpoint} (${f.reason})` : f.reason,
    );
    parts.push(
      `Endpoints that didn't follow: ${failures.join(
        '; ',
      )}. Repeat the action to retry them.`,
    );
  }
  if (parts.length === 0) return undefined;
  return { text: parts.join(' '), failed: result.failed.length > 0 };
}
