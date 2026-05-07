import {
  DiscoveryApi,
  FetchApi,
  createApiRef,
} from '@backstage/core-plugin-api';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

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
 */
export type ChatCaseType = 'build_failure' | 'runtime_debug';

export type ChatScope = {
  namespace?: string;
  project?: string;
  component?: string;
  environment?: string;
  /**
   * Optional pinned workflow-run name. Set by external triggers (e.g. the
   * failed-build snackbar) so the perch-agent's prompt knows which run
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
   * kind of conversation they're starting; left undefined for the generic
   * FAB.
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
};

export type ChatRequest = {
  messages: ChatMessage[];
  scope?: ChatScope;
};

// Mirrors the StreamEvent discriminated union emitted by perch-agent.
// Inlined here (rather than imported from a shared package) so this
// plugin ships independent of other openchoreo plugins. The agent is
// read-only — there is no `actions` event variant.
export type StreamEvent =
  | { type: 'tool_call'; tool: string; activeForm?: string; args?: string }
  | { type: 'message_chunk'; content: string }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string };

export interface PerchAgentApi {
  streamChat(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  /**
   * Fire-and-forget call that pre-populates the per-user MCP tools cache on
   * the agent so the user's first chat doesn't pay the 6-9s tool-listing
   * roundtrip. Resolves as soon as the agent returns 202; the actual fetch
   * runs in the background server-side.
   */
  warmup(): Promise<void>;
}

export const perchAgentApiRef = createApiRef<PerchAgentApi>({
  id: 'plugin.openchoreo-perch.service',
});

/**
 * PerchAgentClient calls the perch-agent service via the
 * ``openchoreo-perch-backend`` Backstage backend plugin (a thin
 * forwarder that streams ndjson upstream → response). The plugin
 * mounts at ``/api/openchoreo-perch-backend`` on the Backstage backend
 * and forwards each call to the configured perch-agent URL.
 *
 * Both the local Backstage routes and the upstream perch-agent
 * service use the same path prefix
 * (``/api/v1alpha1/perch-agent/...``), so the forwarder simply
 * appends the suffix verbatim.
 *
 * Why a backend plugin (not the proxy plugin): see
 * plugins/openchoreo-perch/README.md "Why a backend plugin?" — it's
 * the same shape as the other OpenChoreo backends and gives us a
 * place to add Backstage-side logic later (permissions, server-side
 * scope enrichment, multi-backend routing) without changing the
 * frontend.
 *
 * Discovery resolves to ``http://localhost:7007/api/openchoreo-perch-backend``
 * in dev or the in-cluster Backstage backend URL in deployment.
 */
export class PerchAgentClient implements PerchAgentApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  async streamChat(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const base = await this.discoveryApi.getBaseUrl('openchoreo-perch-backend');
    const url = `${base}/api/v1alpha1/perch-agent/chat`;

    const response = await this.fetchApi.fetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        'Content-Type': 'application/json',
        'x-openchoreo-direct': 'true',
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
      throw new Error(`Perch chat failed: ${errMsg}`);
    }
    if (!response.body) {
      throw new Error('No response body from Perch chat');
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
    const base = await this.discoveryApi.getBaseUrl('openchoreo-perch-backend');
    const url = `${base}/api/v1alpha1/perch-agent/warmup`;

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
}
