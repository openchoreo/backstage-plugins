import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * After a UI-driven auto-deploy save, the OpenChoreo controller takes a
 * few seconds to observe the workload mutation and update
 * `Component.status.latestRelease.name`. A single post-save refetch
 * races the controller and lands stale; the setup card then sits on the
 * old release until the user refreshes.
 *
 * This hook polls for the status change for a bounded window so the
 * setup card updates on its own. The flag also drives a visible
 * "Deploying…" pill on the row.
 *
 * Scope: UI-triggered deploys only — external changes (kubectl edit,
 * other browser tabs) won't trigger this; they'll only catch up on the
 * next page mount.
 */

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

interface UseAwaitNewReleaseArgs {
  /** Current value of `Component.status.latestRelease.name` (or null). */
  latestReleaseName: string | null;
  /** Re-read the Component (drives `latestReleaseName`). */
  refetchAutoDeploy: () => void;
  /**
   * Re-read the environment list. The per-env card reads
   * `environments[].deployment.releaseName` from a separate fetch; it
   * doesn't move when the Component's status flips, so we have to poke
   * it too.
   */
  refetchEnvironments: () => void;
}

interface UseAwaitNewReleaseResult {
  /** True while we're polling after a save. Renders the "Deploying…" pill. */
  awaitingNewRelease: boolean;
  /**
   * Call right before navigating away from the save. Captures the
   * release name we'd just saved against so the poller can detect when
   * the controller has produced a newer one.
   */
  beginAwaitingNewRelease: () => void;
}

export const useAwaitNewRelease = ({
  latestReleaseName,
  refetchAutoDeploy,
  refetchEnvironments,
}: UseAwaitNewReleaseArgs): UseAwaitNewReleaseResult => {
  const [awaiting, setAwaiting] = useState(false);
  // Baseline lives in a ref because we never want a baseline change to
  // re-trigger the polling effect — only `awaiting` should.
  const baselineRef = useRef<string | null>(null);

  const beginAwaitingNewRelease = useCallback(() => {
    baselineRef.current = latestReleaseName;
    setAwaiting(true);
  }, [latestReleaseName]);

  // Stop polling as soon as the controller's pointer moves away from
  // what we captured at save time. This is the happy path.
  useEffect(() => {
    if (!awaiting) return;
    if (latestReleaseName && latestReleaseName !== baselineRef.current) {
      setAwaiting(false);
    }
  }, [awaiting, latestReleaseName]);

  // While awaiting, poll Component status + env list every 2s. The
  // setup card's row updates from status; the per-env card updates from
  // the env list (different fetch). The release-list cache (used for
  // the meta line under the setup card name) refreshes on the next pane
  // interaction — not critical to hot-reload. Hard-stop at 30s so a
  // stuck controller doesn't spin forever; next mount / navigation
  // catches up naturally.
  useEffect(() => {
    if (!awaiting) return undefined;
    const intervalId = setInterval(() => {
      refetchAutoDeploy();
      refetchEnvironments();
    }, POLL_INTERVAL_MS);
    const timeoutId = setTimeout(() => {
      setAwaiting(false);
    }, POLL_TIMEOUT_MS);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [awaiting, refetchAutoDeploy, refetchEnvironments]);

  return { awaitingNewRelease: awaiting, beginAwaitingNewRelease };
};
