import { useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { toastApiRef } from '@backstage/frontend-plugin-api';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import type { DynamicCheck } from '../../api/types';

/**
 * The check a form edits, reloaded after the assistant saves it. The
 * assistant saves without going through the form, so a later Save would
 * otherwise overwrite the assistant's change. `revision` is part of the
 * form's key, since the form copies the check into its state only once.
 */
export function useAssistantSavedCheck(
  initialCheck: DynamicCheck | null,
  onChecksChanged?: () => void,
) {
  const api = useApi(dynamicChecksApiRef);
  const toastApi = useApi(toastApiRef);
  // What the last reload found, for the check it was started on, so opening
  // another check shows that one.
  const [loaded, setLoaded] = useState<{
    of: DynamicCheck | null;
    check: DynamicCheck;
  }>();
  const [revision, setRevision] = useState(0);
  // Counts reloads: an older one that answers late must not replace the
  // check a newer one loaded.
  const reloads = useRef(0);
  // The check the form shows now: a reload that answers after the form moved
  // to another check (closed, then a new one opened) must not touch it, or
  // the new revision would remount the form and drop what was typed there.
  const shown = useRef(initialCheck);
  shown.current = initialCheck;

  async function reloadCheck() {
    onChecksChanged?.();
    const reload = ++reloads.current;
    const of = initialCheck;
    const stale = () => reload !== reloads.current || shown.current !== of;
    try {
      const checks = await api.listChecks();
      if (stale()) return;
      const saved = checks.find(c => c.id === of?.id);
      if (saved) {
        setLoaded({ of, check: saved });
        setRevision(current => current + 1);
      }
    } catch (e) {
      if (stale()) return;
      toastApi.post({
        title: `Couldn't reload the check. Reopen it before saving: ${
          (e as Error).message
        }`,
        status: 'danger',
      });
    }
  }

  const check =
    loaded && loaded.of === initialCheck ? loaded.check : initialCheck;
  return { check, revision, reloadCheck };
}
