import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  useLocation,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';
import type { Navigator } from 'react-router-dom';

/**
 * Asks before a configure page with unsaved changes is left, the way the
 * Workload page does: the back arrow and Esc (through `leave`), in-app
 * navigation such as a menu click, and closing or reloading the tab. Feeds
 * OpenChoreo's UnsavedChangesDialog; `pass` leaves without asking, after a
 * Save.
 */
export function useUnsavedGuard(dirty: boolean) {
  const navigation = useContext(NavigationContext);
  const location = useLocation();
  const allow = useRef(false);
  const pending = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && !allow.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty || !navigation) return undefined;
    const navigator = navigation.navigator as Navigator;
    const { push, replace } = navigator;
    const samePage = (to: any) =>
      (typeof to === 'string' ? to.split('?')[0] : to.pathname) ===
      location.pathname;
    const guard =
      (original: typeof push) => (to: any, state?: any, opts?: any) => {
        if (allow.current || samePage(to)) {
          original.call(navigator, to, state, opts);
          return;
        }
        pending.current = () => original.call(navigator, to, state, opts);
        setOpen(true);
      };
    navigator.push = guard(push);
    navigator.replace = guard(replace);
    return () => {
      navigator.push = push;
      navigator.replace = replace;
    };
  }, [dirty, navigation, location.pathname]);

  const pass = useCallback((go: () => void) => {
    allow.current = true;
    go();
    setTimeout(() => {
      allow.current = false;
    }, 100);
  }, []);

  const leave = useCallback(
    (go: () => void) => {
      if (!dirty) {
        go();
        return;
      }
      pending.current = go;
      setOpen(true);
    },
    [dirty],
  );

  const discard = useCallback(() => {
    setOpen(false);
    const go = pending.current;
    pending.current = null;
    if (go) pass(go);
  }, [pass]);

  const stay = useCallback(() => {
    setOpen(false);
    pending.current = null;
  }, []);

  return { leave, pass, dialog: { open, onDiscard: discard, onStay: stay } };
}
