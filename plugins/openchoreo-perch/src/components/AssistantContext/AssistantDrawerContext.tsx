import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { useAssistantEnabled } from '@openchoreo/backstage-plugin-react';
import { AssistantChatDrawer } from '../AssistantChatDrawer/AssistantChatDrawer';
import {
  assistantAgentApiRef,
  type ChatScope,
} from '../../api/AssistantAgentApi';

/**
 * Pinned context attached to a chat session so the agent (and the user)
 * know what concrete resource the conversation is about. v1 only carries
 * a workflow_run; future variants (log_error, alert, ...) will be added
 * here as discriminated cases.
 */
export type PinnedContext = {
  kind: 'workflow_run';
  namespace: string;
  component: string;
  runName: string;
  runDisplay?: string;
  /** OpenChoreo project the component belongs to. */
  project?: string;
  /** Status of the pinned run, e.g. "Failed". */
  runStatus?: string;
  /** Name of the Workflow / ClusterWorkflow CRD bound to the component. */
  workflowName?: string;
  /** Kind: "Workflow" (namespace-scoped) or "ClusterWorkflow". */
  workflowKind?: string;
  /**
   * Optional case discriminator forwarded into ChatScope.caseType so the
   * agent layers in case-specific guidance. Launchers built for a single
   * scenario (e.g. failed builds) set this; the generic FAB leaves it
   * undefined.
   */
  caseType?: 'build_failure';
};

export type OpenAssistantOptions = {
  /**
   * Pre-seeded user turn. When set, the drawer auto-runs the streamChat
   * pipeline once on open as if the user had typed this message.
   */
  initialMessage?: string;
  /**
   * Resource the conversation is anchored to. Rendered as a chip above
   * the composer and forwarded to the backend via ChatScope.
   */
  pin?: PinnedContext;
  /**
   * Optional explicit ChatScope overrides merged in after the URL- and
   * pin-derived scope. Use this for cases that don't fit the
   * workflow-run pin model but still need to inject scope fields like
   * caseType, namespace, project, or component.
   */
  scopeOverrides?: Partial<ChatScope>;
  /**
   * Stable identifier for "the same chat". Re-opening the drawer with
   * the SAME conversationKey preserves the existing timeline and skips
   * re-seeding the initialMessage — so the user picks up exactly where
   * they left off. A DIFFERENT (or undefined-vs-defined) key wipes the
   * timeline and seeds the new initialMessage.
   *
   * Convention per launcher:
   * - build_failure:  `build_failure:<component>:<runName>`
   * - build_overview: `build_overview:<namespace>:<component>`
   * - logs_debug:    `logs_debug:<namespace>:<component>`
   * - generic FAB:   undefined (or a single sticky key)
   *
   * Launchers that want a fresh chat every time should leave this unset
   * and rely on the openSeq-based wipe.
   */
  conversationKey?: string;
  /**
   * When true, the drawer wipes the timeline and re-seeds the initial
   * message even if ``conversationKey`` matches the last-seeded key.
   * Used by the "Start new" choice on launchers that detected a prior
   * conversation for the same key.
   */
  resetConversation?: boolean;
};

type AssistantDrawerState = {
  isOpen: boolean;
  options: OpenAssistantOptions;
  /**
   * Bumped on every openDrawer() call so the drawer can detect a fresh
   * "open with seed" event even if isOpen was already true.
   */
  openSeq: number;
};

type AssistantDrawerContextValue = {
  state: AssistantDrawerState;
  openDrawer: (opts?: OpenAssistantOptions) => void;
  closeDrawer: () => void;
  /**
   * Whether a prior conversation for ``key`` exists in this session — i.e.
   * the drawer was last seeded with this exact ``conversationKey``. Used
   * by launchers to offer "Continue previous" vs "Start new" instead of a
   * single Investigate button. False on first ever open and after the
   * drawer was wiped (a different key was opened in between).
   */
  hasConversation: (key: string) => boolean;
};

const AssistantDrawerContext =
  createContext<AssistantDrawerContextValue | null>(null);

export const AssistantDrawerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [state, setState] = useState<AssistantDrawerState>({
    isOpen: false,
    options: {},
    openSeq: 0,
  });

  // Pre-warm the per-user MCP tools cache on the agent the first time the
  // provider mounts after sign-in (and only when the assistant feature is on).
  // The agent returns 202 immediately and fetches in the background, so the
  // user's first chat skips the 6-9s tool-listing roundtrip. Best-effort: a
  // failed warmup just means the first chat pays the cache miss as before.
  const enabled = useAssistantEnabled();
  const identityApi = useApi(identityApiRef);
  const assistantApi = useApi(assistantAgentApiRef);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { userEntityRef } = await identityApi.getBackstageIdentity();
        if (cancelled || !userEntityRef) return;
        await assistantApi.warmup();
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, identityApi, assistantApi]);

  // Single-key tracking matches the drawer's single-conversation model:
  // only one chat lives in memory at a time, wiped on key switch. This
  // ref tracks "what is currently in the drawer", set when the drawer
  // actually seeds (which happens for fresh keys, or for same-key opens
  // with resetConversation=true).
  const lastSeededKey = useRef<string | undefined>(undefined);

  const openDrawer = useCallback((opts: OpenAssistantOptions = {}) => {
    // If the open is a "Start new" (resetConversation) for the current
    // key, clear the tracker so subsequent hasConversation() calls return
    // false until the drawer seeds the new chat (which updates it again).
    if (
      opts.resetConversation &&
      opts.conversationKey &&
      lastSeededKey.current === opts.conversationKey
    ) {
      lastSeededKey.current = undefined;
    } else if (opts.conversationKey) {
      // Track keys the drawer is about to seed. The drawer's effect below
      // is the source of truth for "did we actually seed?" but the timing
      // is fine: the only consumer (launcher hasConversation lookup) runs
      // on render, well after openDrawer settles.
      lastSeededKey.current = opts.conversationKey;
    } else {
      lastSeededKey.current = undefined;
    }
    setState(prev => ({
      isOpen: true,
      options: opts,
      openSeq: prev.openSeq + 1,
    }));
  }, []);

  const closeDrawer = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const hasConversation = useCallback(
    (key: string) => lastSeededKey.current === key,
    [],
  );

  const value = useMemo(
    () => ({ state, openDrawer, closeDrawer, hasConversation }),
    [state, openDrawer, closeDrawer, hasConversation],
  );

  return (
    <AssistantDrawerContext.Provider value={value}>
      {children}
      <AssistantChatDrawer
        open={state.isOpen}
        onClose={closeDrawer}
        initialMessage={state.options.initialMessage}
        pin={state.options.pin}
        scopeOverrides={state.options.scopeOverrides}
        conversationKey={state.options.conversationKey}
        resetConversation={state.options.resetConversation}
        openSeq={state.openSeq}
      />
    </AssistantDrawerContext.Provider>
  );
};

/**
 * Read-write hook for any consumer that needs to open/close the drawer
 * or read its current options. Throws if used outside the provider so
 * mounting mistakes fail loudly instead of silently no-oping.
 */
export const useAssistantDrawer = (): AssistantDrawerContextValue => {
  const ctx = useContext(AssistantDrawerContext);
  if (ctx === null) {
    throw new Error(
      'useAssistantDrawer must be used inside <AssistantDrawerProvider>',
    );
  }
  return ctx;
};
