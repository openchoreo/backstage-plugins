import {
  DiscoveryApi,
  FetchApi,
  createApiRef,
} from '@backstage/core-plugin-api';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatCaseType = 'build_failure' | 'logs_debug';

export type ChatScope = {
  namespace?: string;
  project?: string;
  component?: string;
  environment?: string;
  /**
   * Optional pinned workflow-run name. Set by external triggers (e.g. the
   * failed-build snackbar) so the assistant-agent's prompt knows which run
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
};

export type ChatRequest = {
  messages: ChatMessage[];
  scope?: ChatScope;
};

/**
 * One proposed write action surfaced by the agent. Mirrors the backend payload
 * built by `_promote_actions` in assistant-agent. The action_id is the only
 * field /execute consumes; the rest is for the UI.
 */
export type ProposedAction = {
  action_id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  mutating: boolean;
  currentState?: unknown;
  proposedState?: unknown;
};

export type ExecuteResult = {
  success: boolean;
  result?: unknown;
  error?: string;
};

// Mirrors the StreamEvent discriminated union emitted by both rca-agent and
// assistant-agent. Inlined here (rather than imported from a shared package)
// so this plugin ships independent of other openchoreo plugins.
export type StreamEvent =
  | { type: 'tool_call'; tool: string; activeForm?: string; args?: string }
  | { type: 'message_chunk'; content: string }
  | { type: 'actions'; actions: ProposedAction[] }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string };

export interface AssistantAgentApi {
  streamChat(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  executeAction(actionId: string): Promise<ExecuteResult>;
  /**
   * Fire-and-forget call that pre-populates the per-user MCP tools cache on
   * the agent so the user's first chat doesn't pay the 6-9s tool-listing
   * roundtrip. Resolves as soon as the agent returns 202; the actual fetch
   * runs in the background server-side.
   */
  warmup(): Promise<void>;
}

export const assistantAgentApiRef = createApiRef<AssistantAgentApi>({
  id: 'plugin.openchoreo-perch.service',
});

/**
 * AssistantAgentClient calls the assistant-agent service via the
 * ``openchoreo-perch-backend`` Backstage backend plugin (a thin
 * forwarder that streams ndjson upstream → response). The plugin
 * mounts at ``/api/openchoreo-perch-backend`` on the Backstage backend
 * and forwards each call to the configured ``assistant-agent`` URL.
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
export class AssistantAgentClient implements AssistantAgentApi {
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
    const url = `${base}/api/v1alpha1/assistant-agent/chat`;

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
      throw new Error(`Assistant chat failed: ${errMsg}`);
    }
    if (!response.body) {
      throw new Error('No response body from assistant chat');
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

  async executeAction(actionId: string): Promise<ExecuteResult> {
    const base = await this.discoveryApi.getBaseUrl('openchoreo-perch-backend');
    const url = `${base}/api/v1alpha1/assistant-agent/execute`;

    const response = await this.fetchApi.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action_id: actionId }),
      headers: {
        'Content-Type': 'application/json',
        'x-openchoreo-direct': 'true',
      },
    });

    if (!response.ok) {
      let errMsg = response.statusText;
      try {
        const body = await response.json();
        errMsg = body?.detail?.message ?? body?.error ?? errMsg;
      } catch {
        // ignore
      }
      return { success: false, error: `Execute failed: ${errMsg}` };
    }

    return (await response.json()) as ExecuteResult;
  }

  async warmup(): Promise<void> {
    const base = await this.discoveryApi.getBaseUrl('openchoreo-perch-backend');
    const url = `${base}/api/v1alpha1/assistant-agent/warmup`;

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
