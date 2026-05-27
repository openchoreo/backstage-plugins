import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import type { WirelogEvent, WirelogStreamStatus } from './types';

interface UseWirelogsStreamArgs {
  namespaceName: string | undefined;
  projectName: string | undefined;
  environmentName: string | undefined;
  componentName?: string | undefined;
  maxBuffer?: number;
}

interface UseWirelogsStreamResult {
  flows: WirelogEvent[];
  status: WirelogStreamStatus;
  error: string | null;
  totalReceived: number;
  start: () => void;
  stop: () => void;
  clear: () => void;
}

const DEFAULT_MAX_BUFFER = 500;

/**
 * Consumes the openchoreo-backend `/wirelogs/stream` SSE proxy.
 *
 * Uses fetchApi.fetch so the Backstage session cookie / token rides along;
 * EventSource is avoided because it can't carry the auth header the backend
 * middleware expects. The body is parsed as text/event-stream client-side:
 * SSE frames are separated by blank lines, and each `data:` line is a JSON
 * object matching the `WirelogEvent` shape.
 *
 * Older flows are evicted past `maxBuffer` to keep the table responsive on
 * busy clusters — Hubble can emit 100s of flows/sec in a steady state.
 */
export function useWirelogsStream({
  namespaceName,
  projectName,
  environmentName,
  componentName,
  maxBuffer = DEFAULT_MAX_BUFFER,
}: UseWirelogsStreamArgs): UseWirelogsStreamResult {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [flows, setFlows] = useState<WirelogEvent[]>([]);
  const [status, setStatus] = useState<WirelogStreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [totalReceived, setTotalReceived] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus(prev =>
      prev === 'streaming' || prev === 'connecting' ? 'closed' : prev,
    );
  }, []);

  const clear = useCallback(() => {
    setFlows([]);
    setTotalReceived(0);
    setError(null);
  }, []);

  const start = useCallback(() => {
    if (!namespaceName || !projectName || !environmentName) {
      setError('namespace, project and environment are required');
      setStatus('error');
      return;
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
    stopRequestedRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('connecting');
    setError(null);

    (async () => {
      try {
        const baseUrl = await discovery.getBaseUrl('openchoreo');
        const url = new URL(`${baseUrl}/wirelogs/stream`);
        url.searchParams.set('namespaceName', namespaceName);
        url.searchParams.set('projectName', projectName);
        url.searchParams.set('environmentName', environmentName);
        if (componentName) {
          url.searchParams.set('componentName', componentName);
        }

        const response = await fetchApi.fetch(url.toString(), {
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(
            text ||
              `Stream request failed: ${response.status} ${response.statusText}`,
          );
        }
        if (!response.body) {
          throw new Error('Stream response had no body');
        }

        setStatus('streaming');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streaming = true;

        while (streaming) {
          const { value, done } = await reader.read();
          if (done) {
            streaming = false;
            break;
          }
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are delimited by a blank line ("\n\n"). Anything left
          // after the last \n\n is a partial frame — keep it in the buffer.
          let separatorIdx = buffer.indexOf('\n\n');
          while (separatorIdx !== -1) {
            const frame = buffer.slice(0, separatorIdx);
            buffer = buffer.slice(separatorIdx + 2);

            const parsed = parseSseFrame(frame);
            if (parsed?.kind === 'data') {
              setFlows(prev => {
                const next = [...prev, parsed.event];
                return next.length > maxBuffer
                  ? next.slice(next.length - maxBuffer)
                  : next;
              });
              setTotalReceived(prev => prev + 1);
            } else if (parsed?.kind === 'error') {
              setError(parsed.message);
              setStatus('error');
            }

            separatorIdx = buffer.indexOf('\n\n');
          }
        }
        if (!stopRequestedRef.current) {
          setStatus('closed');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError((err as Error).message || 'Stream failed');
        setStatus('error');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    })();
  }, [
    discovery,
    fetchApi,
    namespaceName,
    projectName,
    environmentName,
    componentName,
    maxBuffer,
  ]);

  useEffect(() => () => stop(), [stop]);

  // Reset state if the user switches environment/component while streaming.
  useEffect(() => {
    if (abortRef.current) {
      stop();
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaceName, projectName, environmentName, componentName]);

  return {
    flows,
    status,
    error,
    totalReceived,
    start,
    stop,
    clear,
  };
}

type ParsedFrame =
  | { kind: 'data'; event: WirelogEvent }
  | { kind: 'error'; message: string }
  | undefined;

function parseSseFrame(frame: string): ParsedFrame {
  const lines = frame.split('\n');
  let eventType: string | undefined;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    } else if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    }
  }
  if (dataLines.length === 0) return undefined;
  const payload = dataLines.join('\n');
  try {
    const parsed = JSON.parse(payload);
    if (eventType === 'error') {
      return { kind: 'error', message: parsed.message || 'Stream error' };
    }
    if (parsed && typeof parsed === 'object' && parsed.flow) {
      return { kind: 'data', event: parsed as WirelogEvent };
    }
  } catch {
    // ignore malformed frame
  }
  return undefined;
}
