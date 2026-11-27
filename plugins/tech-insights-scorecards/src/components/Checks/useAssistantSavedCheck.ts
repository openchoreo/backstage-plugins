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

  async function reloadCheck() {
    onChecksChanged?.();
    const reload = ++reloads.current;
    try {
      const checks = await api.listChecks();
      if (reload !== reloads.current) return;
      const saved = checks.find(c => c.id === initialCheck?.id);
      if (saved) {
        setLoaded({ of: initialCheck, check: saved });
        setRevision(current => current + 1);
      }
    } catch (e) {
      if (reload !== reloads.current) return;
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
