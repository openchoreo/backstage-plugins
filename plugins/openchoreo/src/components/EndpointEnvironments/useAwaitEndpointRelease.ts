import { useCallback, useEffect, useRef, useState } from 'react';
import type { EndpointBackend } from '../EndpointOverview/EndpointBackendList';

/** A saved change to an Endpoint's backends, identified by backend name. */
export type EndpointBackendChange =
  | { kind: 'add'; backendName: string }
  | { kind: 'weight'; backendName: string; weight: number }
  | { kind: 'remove'; backendName: string };

/** Whether the catalog entity's backends show a saved change yet. */
export function backendsReflect(
  change: EndpointBackendChange,
  backends: EndpointBackend[],
): boolean {
  const backend = backends.find(b => b.name === change.backendName);
  switch (change.kind) {
    case 'add':
      return !!backend;
    case 'weight':
      // A missing weight is the CRD default, 1.
      return !!backend && (backend.weight ?? 1) === change.weight;
    case 'remove':
      return !backend;
    default:
      return true;
  }
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

interface UseAwaitEndpointReleaseArgs {
  /** The Endpoint's latest release, as the environment list reports it. */
  latestRelease: string | undefined;
  /** The backends on the catalog entity. */
  backends: EndpointBackend[];
  /** Re-reads the environment list, which carries the latest release. */
  refetchEnvironments: () => void | Promise<void>;
  /** Re-reads the catalog entity, which carries the backends. */
  refreshEntity: () => void;
}

/**
 * After a backend change, the Endpoint controller cuts a new release within
 * seconds, and the catalog entity follows by event. This polls both until the
 * latest release has moved past the one at save time and the entity shows
 * the change, so the Set up pane can show the change as in progress and then
 * the updated backends with the new release to deploy. It gives up after 30
 * seconds, so a stuck controller doesn't spin forever.
 */
export function useAwaitEndpointRelease({
  latestRelease,
  backends,
  refetchEnvironments,
  refreshEntity,
}: UseAwaitEndpointReleaseArgs): {
  awaitingNewRelease: boolean;
  beginAwaitingNewRelease: (change: EndpointBackendChange) => void;
} {
  const [pending, setPending] = useState<{
    baseline: string | undefined;
    change: EndpointBackendChange;
  } | null>(null);

  // Callbacks in refs, so a new identity doesn't restart the poll.
  const refetchRef = useRef(refetchEnvironments);
  const refreshRef = useRef(refreshEntity);
  refetchRef.current = refetchEnvironments;
  refreshRef.current = refreshEntity;

  const beginAwaitingNewRelease = useCallback(
    (change: EndpointBackendChange) =>
      setPending({ baseline: latestRelease, change }),
    [latestRelease],
  );

  useEffect(() => {
    if (!pending) return;
    if (
      latestRelease &&
      latestRelease !== pending.baseline &&
      backendsReflect(pending.change, backends)
    ) {
      setPending(null);
    }
  }, [pending, latestRelease, backends]);

  const active = pending !== null;
  useEffect(() => {
    if (!active) return undefined;
    const poll = () => {
      void refetchRef.current();
      refreshRef.current();
    };
    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    const timeoutId = setTimeout(() => setPending(null), POLL_TIMEOUT_MS);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [active]);

  return { awaitingNewRelease: active, beginAwaitingNewRelease };
}
