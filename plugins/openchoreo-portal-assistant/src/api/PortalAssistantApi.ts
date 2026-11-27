import {
  DiscoveryApi,
  FetchApi,
  IdentityApi,
  createApiRef,
} from '@backstage/core-plugin-api';

/**
 * Carries the signed-in user's Backstage token to the Backstage backend
 * forwarder (see PortalAssistantClient.streamChat).
 */
export const BACKSTAGE_IDENTITY_HEADER = 'x-backstage-identity';

/**
 * The drawer button a user message came from: its A2UI event's name and
 * context. The agent follows a decision button's action, not its words; a
 * typed message has none.
 */
export type ChatAction = {
  name: string;
  context?: Record<string, string | number>;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  action?: ChatAction;
};

/**
 * A single pre-rendered log row passed to the agent in
 * {@link ChatScope.prefetchedLogs} so the first ``query_component_logs``
 * tool call can be skipped. The frontend captures these from whatever
 * the user currently has rendered on the Logs tab; the agent treats
 * them as authoritative for turn 1 and only re-queries if it needs a
 * wider window than what is on screen.
 */
export type PrefetchedLogEntry = {
  /** RFC3339 timestamp from the indexed log row. */
  timestamp?: string;
  /** Severity (e.g. ``ERROR``/``WARN``/``INFO``/``DEBUG``). */
  level?: string;
  /** The log line, trimmed to a per-row character cap on the frontend. */
  message: string;
  /** Component name resolved by the observer (when available). */
  componentName?: string;
  /** Environment name resolved by the observer (when available). */
  environmentName?: string;
};

/**
 * One fact exposed by a registered fact retriever, forwarded to the agent
 * in {@link ChatScope.availableFactRetrievers} so it only references facts
 * that actually exist on this backend instead of hallucinating names.
 * Mirrors ``FactRetrieverField`` in portal-assistant's ``agent_routes.py``.
 */
export type FactRetrieverField = {
  name: string;
  type: string;
  description?: string;
};

/**
 * One registered fact retriever and the facts it exposes, as forwarded in
 * {@link ChatScope.availableFactRetrievers}. Mirrors ``FactRetriever`` in
 * portal-assistant's ``agent_routes.py`` — the check_authoring prompt
 * branch renders this into the "Available facts" table in perch_prompt.j2.
 */
export type FactRetriever = {
  id: string;
  /** Entity kinds it collects facts for; absent when not limited to any. */
  kinds?: string[];
  facts: FactRetrieverField[];
};

/**
 * Discriminator the frontend launchers send to the agent so it can
 * layer in case-specific guidance.
 *
 * - ``build_failure``: failed-build snackbar / build-page launcher.
 * - ``runtime_debug``: logs-anchored runtime investigation. The
 *   agent's prompt pivots to traces when a ``trace_id`` token shows
 *   up in returned log rows (or when ``pinnedLogTraceId`` is set
 *   from the row-level Investigate button) — there is no
 *   trace-page launcher; users start from the Logs tab.
 * - ``dependency_pending``: Deploy tab / K8s-artifacts investigation
 *   of a component stuck NotReady because an outbound endpoint
 *   connection can't resolve (the depended-on component is undeployed
 *   or not ready). The agent reads the binding's pending connections
 *   and explains why each named dependency is down plus how to recover.
 * - ``check_authoring``: check-editor create/edit view launcher. The
 *   agent drafts json-rules-engine check syntax from a plain-language
 *   description; the user reviews it in the popup and copies it into
 *   the Rule field themselves (no automatic insert yet).
 */
export type ChatCaseType =
  | 'build_failure'
  | 'runtime_debug'
  | 'dependency_pending'
  | 'check_authoring';

export type ChatScope = {
  namespace?: string;
  project?: string;
  component?: string;
  environment?: string;
  /**
   * Optional pinned workflow-run name. Set by external triggers (e.g. the
   * failed-build snackbar) so the portal-assistant's prompt knows which run
   * is being discussed without the LLM having to infer it from text.
   */
  runName?: string;
  /** Status string of the pinned run, e.g. "Failed", "Errored", "Succeeded". */
  runStatus?: string;
  /** Name of the Workflow / ClusterWorkflow CRD the component is bound to. */
  workflowName?: string;
  /** Kind of the bound workflow CRD: "Workflow" or "ClusterWorkflow". */
  workflowKind?: string;
  /**
   * Discriminator that lets the agent layer in case-specific guidance on
   * top of the base system prompt. Set by purpose-built launchers
   * (FailedBuildSnackbar, BuildPagePromptLauncher) that already know what
   * kind of conversation they're starting; left undefined when the chat is
   * opened without a specific case.
   */
  caseType?: ChatCaseType;
  /**
   * Log severity filter the user has selected on the Logs tab (e.g.
   * ``["ERROR","WARN","INFO"]``). When set, the agent uses these
   * verbatim as ``log_levels`` for ``query_component_logs`` instead of
   * its own narrow ERROR/WARN default. Lets the empty-state answer
   * match what the user actually sees on screen.
   */
  logLevels?: string[];
  /**
   * RFC3339 timestamps describing the logs/traces window currently
   * rendered on the page. Pre-computed in the browser so the LLM
   * never has to synthesise timestamps (it has no clock and routinely
   * hallucinates dates). When both are set, the agent's runtime_debug
   * branch uses them verbatim for ``start_time`` / ``end_time``.
   */
  logsStartTime?: string;
  logsEndTime?: string;

  // ── Runtime-debug anchors (for caseType === 'runtime_debug') ────

  /**
   * Marks the chat as runtime-anchored from the Logs tab. The agent's
   * prompt branches on this to pick the log-first sub-flow (then
   * pivots to traces via ``query_trace_spans`` / ``query_traces`` when
   * a trace_id appears in the log rows or is pinned via the row-level
   * Investigate button). Today only ``'log'`` is emitted; the field
   * remains an enum-typed string so a future caller can add a new
   * anchor without a wire-format change.
   */
  runtimeAnchor?: 'log';

  /**
   * Snapshot of the log rows currently rendered on the Logs tab. When
   * set, the agent's runtime_debug branch uses these rows directly
   * instead of issuing a ``query_component_logs`` call on turn 1 —
   * saving the ~5-15 s tool roundtrip. Capped per row (message
   * trimmed) and in length (max 50 rows) to keep the request body
   * inside the agent's per-request content-size budget.
   */
  prefetchedLogs?: PrefetchedLogEntry[];

  /**
   * Log-side anchors set when the user clicked a specific log row
   * (the row-level ``InvestigateLogButton`` affordance). When
   * ``pinnedLogTraceId`` is present the agent fans out a parallel
   * ``query_trace_spans`` + ``query_traces`` so the user can see
   * what request and what concurrent traces matched the log line.
   */
  pinnedLogTimestamp?: string;
  pinnedLogMessage?: string;
  pinnedLogTraceId?: string;

  /**
   * Git repository URL pulled off the component's workflow schema by the
   * Backstage launcher. The portal-assistant prompt uses this to drop the
   * URL into the ``fix_prompt`` it emits on build_failure turns — so the
   * external coding bot (CodeRabbit / Cursor / Claude Code) knows where
   * to look without the user pasting it manually. The agent never reads
   * the URL itself; it just passes it through into the generated prompt.
   */
  repoUrl?: string;
  /**
   * In-repo build path (the component's workflow ``repository.appPath``)
   * pulled off the schema next to ``repoUrl``. The portal-assistant prompt
   * adds it as a ``Path:`` line in the ``fix_prompt`` so the external coding
   * bot knows which sub-directory of a monorepo the failing build ran in.
   * Optional — root-of-repo builds omit it; the agent passes it through
   * verbatim and never reads it itself.
   */
  componentPath?: string;

  // ── Check-authoring scope fields (for caseType === 'check_authoring') ──

  /**
   * Fact retrievers registered on the tech-insights backend, forwarded so
   * the check_authoring agent can draft ``rule.conditions`` against facts
   * that actually exist instead of inventing names. Set by the "Generate
   * with AI" and "Edit with AI" launchers from the same fact schemas
   * response the form itself uses to populate the retriever picker.
   */
  availableFactRetrievers?: FactRetriever[];
  /**
   * Fact retriever ids already selected in the check-editor form. The agent
   * treats these as a preference, not a hard restriction — it may still
   * reach for a different retriever in ``availableFactRetrievers`` when the
   * request needs a fact none of the selected ones provide.
   */
  selectedFactIds?: string[];
  /**
   * Set when the launcher is opened from the edit dialog of an existing
   * check. The agent edits ``currentRule`` (the check's ``rule.conditions``
   * as a JSON string) instead of drafting a new check, and uses the name
   * and description to suggest related text changes.
   */
  checkId?: string;
  checkName?: string;
  checkDescription?: string;
  currentRule?: string;
  /** A level's message: the reply is the check authoring chat's welcome. */
  welcome?: boolean;
  /** How much the user knows about checks; check authoring only. */
  experience?: Experience;
};

/** The level a check authoring user picked, for the agent to suit replies to. */
export type Experience = 'beginner' | 'experienced';

export type ChatRequest = {
  messages: ChatMessage[];
  scope?: ChatScope;
};

/** A suggested change to one text field of a check. */
export type CheckTextChange = {
  field: 'name' | 'description';
  label: string;
  old?: string | null;
  new: string;
};

export type CheckStatus = 'draft' | 'published';

/**
 * A check change ready to save, sent before `done` in check-authoring chats:
 * an edit (`kind: 'update'`) or a drafted new check (`kind: 'create'`). The
 * drawer shows it as a confirm card; nothing is saved until the user picks
 * a button, which sends `token` to {@link PortalAssistantApi.confirmChange}.
 */
export type ConfirmationRequired = {
  type: 'confirmation_required';
  token: string;
  kind: 'update' | 'create';
  check_name: string;
  new_rule: string;
  valid: boolean;
  problems?: string[];
  /** Numbers in the rule its texts don't match; shown, not blocking. */
  warnings?: string[];
  /** Tested on a component in this turn: offer only to save, not another test. */
  tested?: boolean;
  /** The user skipped the test or asked to save: offer only to save. */
  test_skipped?: boolean;
  /**
   * A beginner's practice check (the welcome's example): once tested, the
   * card offers what to do next instead of saving.
   */
  example?: boolean;
  /** Edits only. */
  check_id?: string | null;
  status?: CheckStatus | null;
  current_rule?: string | null;
  text_changes?: CheckTextChange[];
  /** New checks only. */
  description?: string | null;
  fact_ids?: string[];
  category?: string | null;
  tier?: string | null;
  /** Entity kinds the check will apply to; empty when not limited to any. */
  applies_to?: string[];
};

/**
 * UI for a reply, sent before `done`: A2UI v1.0 messages (`createSurface` …)
 * built by the agent's code. The drawer renders them under the reply; a
 * button's `userMessage` is sent as the user's next message. Today: the
 * answer buttons of a check edit's confirmation question.
 */
export type A2uiEvent = {
  type: 'a2ui';
  messages: unknown[];
};

/**
 * A dry_run_check result, sent as soon as it comes back so the drawer can
 * show it while the reply is still being written. The words are the ones
 * its test card shows at the end: `title` is the component, `subtitle` its
 * kind, and `sections` what the rule needs and what the component has.
 */
export type DryRunResult = {
  type: 'dry_run_result';
  status: 'passed' | 'failed' | 'not-applicable';
  title: string;
  subtitle?: string;
  summary: string;
  sections: { label: string; lines: { label: string; value: string }[] }[];
};

/** What the confirm endpoint saved. */
export type ConfirmResult = {
  check_id: string;
  /** The check's status now — differs from the one asked for when only the save worked. */
  status: CheckStatus;
  message: string;
};

// Mirrors the StreamEvent discriminated union emitted by portal-assistant.
// Inlined here (rather than imported from a shared package) so this
// plugin ships independent of other openchoreo plugins. The agent itself
// never writes: a check change arrives as `confirmation_required` and is
// saved only through confirmChange, on the user's click.
export type StreamEvent =
  | { type: 'tool_call'; tool: string; activeForm?: string; args?: string }
  | { type: 'message_chunk'; content: string }
  | {
      type: 'done';
      message: string;
      /**
       * Paste-ready prompt for an external coding bot, produced by the
       * agent on build_failure turns that name a code-level cause. The
       * drawer renders a per-message "Copy as prompt" affordance iff
       * this is set — the frontend never synthesises the prompt; it
       * just exposes whatever the backend supplied. Snake_case to
       * match the wire format emitted by portal-assistant's DoneEvent
       * (``model_dump_json`` uses field names, not aliases).
       */
      fix_prompt?: string;
    }
  | ConfirmationRequired
  | A2uiEvent
  | DryRunResult
  | { type: 'error'; message: string };

export interface PortalAssistantApi {
  streamChat(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  /**
   * Saves the check change on a confirm card, as the signed-in user, and
   * leaves the check in `status`. `applyTexts` also saves the card's
   * suggested Name / Description. Rejects with the reason
   * when nothing was saved.
   */
  confirmChange(
    token: string,
    status: CheckStatus,
    applyTexts: boolean,
  ): Promise<ConfirmResult>;
  /**
   * Fire-and-forget call that pre-populates the per-user MCP tools cache on
   * the agent so the user's first chat doesn't pay the 6-9s tool-listing
   * roundtrip. Resolves as soon as the agent returns 202; the actual fetch
   * runs in the background server-side.
   */
  warmup(): Promise<void>;
}

export const portalAssistantApiRef = createApiRef<PortalAssistantApi>({
  id: 'plugin.openchoreo-portal-assistant.service',
});

/**
 * PortalAssistantClient calls the portal-assistant service via the
 * ``openchoreo-portal-assistant-backend`` Backstage backend plugin (a
 * thin forwarder that streams ndjson upstream → response). The plugin
 * mounts at ``/api/openchoreo-portal-assistant-backend`` on the
 * Backstage backend and forwards each call to the configured
 * portal-assistant URL.
 *
 * Both the local Backstage routes and the upstream portal-assistant
 * service use the same path prefix
 * (``/api/v1alpha1/portal-assistant/...``), so the forwarder simply
 * appends the suffix verbatim.
 *
 * Why a backend plugin (not the proxy plugin): see
 * plugins/openchoreo-portal-assistant/README.md "Why a backend plugin?" — it's
 * the same shape as the other OpenChoreo backends and gives us a
 * place to add Backstage-side logic later (permissions, server-side
 * scope enrichment, multi-backend routing) without changing the
 * frontend.
 *
 * Discovery resolves to ``http://localhost:7007/api/openchoreo-portal-assistant-backend``
 * in dev or the in-cluster Backstage backend URL in deployment.
 */
export class PortalAssistantClient implements PortalAssistantApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly identityApi: IdentityApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    identityApi: IdentityApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
    this.identityApi = options.identityApi;
  }

  /**
   * The signed-in user's Backstage token, for the Backstage backend forwarder
   * to act on the user's behalf. Direct mode puts the OpenChoreo token in
   * `Authorization`, so this rides in its own header. The forwarder is on
   * the Backstage backend itself and never passes this header on; without a
   * token the chat still works, read-only.
   */
  private async backstageIdentityHeaders(): Promise<Record<string, string>> {
    try {
      const { token } = await this.identityApi.getCredentials();
      return token ? { [BACKSTAGE_IDENTITY_HEADER]: token } : {};
    } catch {
      return {};
    }
  }

  async streamChat(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const base = await this.discoveryApi.getBaseUrl(
      'openchoreo-portal-assistant-backend',
    );
    const url = `${base}/api/v1alpha1/portal-assistant/chat`;

    const response = await this.fetchApi.fetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        'Content-Type': 'application/json',
        'x-openchoreo-direct': 'true',
        ...(await this.backstageIdentityHeaders()),
      },
      signal,
    });

    if (!response.ok) {
      let errMsg = response.statusText;
      try {
        const body = await response.json();
        errMsg = body?.detail?.message ?? body?.error ?? errMsg;
      } catch {
        // ignore JSON parse failure; fall back to statusText
      }
      throw new Error(`Portal Assistant chat failed: ${errMsg}`);
    }
    if (!response.body) {
      throw new Error('No response body from Portal Assistant chat');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (done) break;

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            onEvent(JSON.parse(trimmed) as StreamEvent);
          } catch {
            // Skip malformed JSON
          }
        }
      }
      const tail = buffer.trim();
      if (tail) {
        try {
          onEvent(JSON.parse(tail) as StreamEvent);
        } catch {
          // ignore
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async warmup(): Promise<void> {
    const base = await this.discoveryApi.getBaseUrl(
      'openchoreo-portal-assistant-backend',
    );
    const url = `${base}/api/v1alpha1/portal-assistant/warmup`;

    try {
      await this.fetchApi.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openchoreo-direct': 'true',
        },
      });
    } catch {
      // best-effort — first chat will simply pay the cache miss
    }
  }

  async confirmChange(
    token: string,
    status: CheckStatus,
    applyTexts: boolean,
  ): Promise<ConfirmResult> {
    const base = await this.discoveryApi.getBaseUrl(
      'openchoreo-portal-assistant-backend',
    );
    const response = await this.fetchApi.fetch(
      `${base}/api/v1alpha1/portal-assistant/chat/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ token, status, applyTexts }),
        headers: {
          'Content-Type': 'application/json',
          'x-openchoreo-direct': 'true',
          ...(await this.backstageIdentityHeaders()),
        },
      },
    );
    if (!response.ok) {
      let message = response.statusText;
      try {
        const body = await response.json();
        message = body?.detail?.message ?? body?.message ?? message;
      } catch {
        // keep statusText
      }
      throw new Error(message || 'The change could not be saved.');
    }
    return (await response.json()) as ConfirmResult;
  }
}
