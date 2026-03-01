import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';
import { ObserverUrlCache } from './ObserverUrlCache';

// Re-export types from generated client
export type ChatMessage = AIRCAAgentComponents['schemas']['ChatMessage'];
export type StreamEvent = AIRCAAgentComponents['schemas']['StreamEvent'];

export interface ChatRoutingContext {
  namespaceName: string;
  environmentName: string;
}

export interface ChatRequest {
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
    routing: ChatRoutingContext,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}

export const rcaAgentApiRef = createApiRef<RCAAgentApi>({
  id: 'plugin.openchoreo-rca-agent.service',
});

export class RCAAgentClient implements RCAAgentApi {
  private readonly fetchApi: FetchApi;
  private readonly urlCache: ObserverUrlCache;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.fetchApi = options.fetchApi;
    this.urlCache = new ObserverUrlCache(options);
  }

  async streamRCAChat(
    request: ChatRequest,
    routing: ChatRoutingContext,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const { rcaAgentUrl } = await this.urlCache.resolveUrls(
      routing.namespaceName,
      routing.environmentName,
    );

    if (!rcaAgentUrl) {
      throw new Error('RCA service is not configured');
    }

    const response = await this.fetchApi.fetch(
      `${rcaAgentUrl}/api/v1/agent/chat`,
      {
        method: 'POST',
        body: JSON.stringify(request),
        headers: {
          'Content-Type': 'application/json',
          'x-openchoreo-direct': 'true',
        },
        signal,
      },
    );

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
