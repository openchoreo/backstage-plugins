import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';

// Re-export types from generated client
export type ChatMessage = AIRCAAgentComponents['schemas']['ChatMessage'];
export type StreamEvent = AIRCAAgentComponents['schemas']['StreamEvent'];

export interface ChatRequest {
  namespaceName: string;
  environmentName: string;
  reportId: string;
  projectUid: string;
  environmentUid: string;
  componentUid?: string;
  messages: ChatMessage[];
  version?: number;
}

export interface RCAAgentApi {
  streamRCAChat(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}

export const rcaAgentApiRef = createApiRef<RCAAgentApi>({
  id: 'plugin.openchoreo-rca-agent.service',
});

export class RCAAgentClient implements RCAAgentApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  async streamRCAChat(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const baseUrl = await this.discoveryApi.getBaseUrl(
      'openchoreo-observability-backend',
    );

    const response = await this.fetchApi.fetch(`${baseUrl}/chat`, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `RCA chat failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from RCA chat');
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
        const value = result.value;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split by newlines (NDJSON format)
        const lines = buffer.split('\n');

        // Keep incomplete last line in buffer
        buffer = lines.pop() || '';

        // Process complete lines
        for (const line of lines) {
          if (line.trim()) {
            try {
              const event: StreamEvent = JSON.parse(line);
              onEvent(event);
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event: StreamEvent = JSON.parse(buffer);
          onEvent(event);
        } catch {
          // Skip malformed JSON
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
