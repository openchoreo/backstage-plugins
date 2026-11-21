import { useEffect, useRef } from 'react';
import type { BindingRevision } from '@openchoreo/backstage-plugin-common';

/**
 * Calls onChange when the active revision, or its health, changes after the
 * first time a revision is active: not when the history first loads.
 *
 * The deploy panel uses it to refresh the environment, whose "Deployed" time
 * is the binding's lastSpecUpdateTime. The controller writes that only after
 * it has applied the new spec: later than a rollback call returns, and later
 * than the revision turns active. The revision list keeps polling while the
 * active revision is Progressing, so its health leaving Progressing is the
 * cue that the new time is there, without polling of its own.
 */
export function useActiveRevisionChange(
  active: BindingRevision | undefined,
  onChange: () => void,
): void {
  const key = active
    ? `${active.metadata.name}:${active.status?.health ?? ''}`
    : '';
  const seen = useRef(key);
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    if (seen.current === key) return;
    const firstLoad = seen.current === '';
    seen.current = key;
    if (!firstLoad) callback.current();
  }, [key]);
}
