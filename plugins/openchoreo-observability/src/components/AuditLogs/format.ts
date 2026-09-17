import { AuditLogActor, AuditLogResource } from './types';

/**
 * How the call arrived. `surface` is open on the record where the filter is
 * closed, so a value this client predates is named rather than described as one
 * of the two it knows.
 */
export function surfaceLabel(surface: string): string {
  if (surface === 'mcp') return 'via MCP';
  if (surface === 'rest') return 'via the REST API';
  return `via ${surface}`;
}

/**
 * Compact relative age (`4m ago`, `3d ago`) — the table shows it under the
 * absolute time, where the shared `formatRelativeTime`'s long form would wrap.
 */
export function relativeAge(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

/** `03 Sep 14:22:05`, in the viewer's locale and 24-hour time. */
export function absoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  })} ${date.toLocaleTimeString([], { hour12: false })}`;
}

export function fullTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString([], { hour12: false });
}

/**
 * The product token that identifies a client. Chrome and Safari hide theirs
 * behind `Mozilla/5.0`, so pull the recognisable one out; everything else
 * already leads with its own name (`occ/1.4.2`).
 */
export function shortUserAgent(userAgent: string): string {
  // Edge carries `Chrome/` ahead of its own token, so the generic match below
  // would name it Chrome.
  const edge = userAgent.match(/Edg\/(\d+)/);
  if (edge) return `Edge ${edge[1]}`;

  const browser = userAgent.match(/(Chrome|Firefox|Version)\/(\d+)/);
  if (browser) {
    const name = browser[1] === 'Version' ? 'Safari' : browser[1];
    return `${name} ${browser[2]}`;
  }
  return userAgent.split(' ')[0];
}

/** Two characters for the actor avatar, from an email local part or an id. */
export function actorInitials(actor: AuditLogActor): string {
  if (actor.type === 'anonymous') return '?';
  const local = actor.id.split('@')[0];
  const words = local.split(/[.\-_]/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

/** The hierarchy the decision was authorized at, outermost first. */
export function scopeSegments(resource?: AuditLogResource | null): string[] {
  if (!resource) return [];
  return [
    resource.namespace,
    resource.project,
    resource.component,
    resource.resource,
  ].filter((value): value is string => Boolean(value));
}

/** A count, grouped for reading. The API counts fully, so it is exact. */
export function formatTotal(total: number): string {
  return total.toLocaleString();
}
