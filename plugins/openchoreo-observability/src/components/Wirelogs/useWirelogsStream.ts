import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import type {
  WirelogEvent,
  WirelogStreamStatus,
  WirelogStreamClosedReason,
} from './types';

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
  /** Epoch ms when the current stream entered `streaming`, else null. */
  startedAt: number | null;
  /** Server-advertised hard cap (ms) for a single stream, from the `meta` frame. */
  hardTimeoutMs: number | null;
  /** Why the stream last reached a terminal state (null while active/idle). */
  closedReason: WirelogStreamClosedReason | null;
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
 * The backend also emits two control frames: `meta` (carries the hard stream
 * timeout so the UI can warn before it hits) and `timeout` (sent right before
 * the server ends a stream that reached the cap, so the UI can label the stop
 * accurately rather than as a generic error).
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
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [hardTimeoutMs, setHardTimeoutMs] = useState<number | null>(null);
  const [closedReason, setClosedReason] =
    useState<WirelogStreamClosedReason | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const eventCounterRef = useRef(0);

  // First terminal reason wins for a given session (e.g. a server `timeout`
  // frame shouldn't be overwritten by the `ended` that follows when the
  // backend closes the connection, nor by an unmount-triggered stop()).
  const markClosedReason = useCallback((reason: WirelogStreamClosedReason) => {
    setClosedReason(prev => prev ?? reason);
  }, []);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus(prev =>
      prev === 'streaming' || prev === 'connecting' ? 'closed' : prev,
    );
    markClosedReason('user');
  }, [markClosedReason]);

  const clear = useCallback(() => {
    setFlows([]);
    setTotalReceived(0);
    setError(null);
    setClosedReason(null);
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
    setClosedReason(null);
    setStartedAt(null);
    setHardTimeoutMs(null);

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
        setStartedAt(Date.now());

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
              eventCounterRef.current += 1;
              const event: WirelogEvent = {
                ...parsed.event,
                __id: `ev-${eventCounterRef.current}`,
              };
              setFlows(prev => {
                const next = [...prev, event];
                return next.length > maxBuffer
                  ? next.slice(next.length - maxBuffer)
                  : next;
              });
              setTotalReceived(prev => prev + 1);
            } else if (parsed?.kind === 'error') {
              setError(parsed.message);
              setStatus('error');
              markClosedReason('error');
            } else if (parsed?.kind === 'meta') {
              setHardTimeoutMs(parsed.hardTimeoutMs);
            } else if (parsed?.kind === 'timeout') {
              // The server is about to end the stream because it hit the hard
              // cap. Record the reason; status flips to `closed` when the
              // backend closes and `done` fires below.
              markClosedReason('timeout');
            }

            separatorIdx = buffer.indexOf('\n\n');
          }
        }
        if (!stopRequestedRef.current) {
          setStatus('closed');
          markClosedReason('ended');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError((err as Error).message || 'Stream failed');
        setStatus('error');
        markClosedReason('error');
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
    markClosedReason,
  ]);

  useEffect(() => () => stop(), [stop]);

  // Reset state when the user switches environment/component.
  useEffect(() => {
    if (abortRef.current) {
      stop();
    }
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaceName, projectName, environmentName, componentName]);

  return {
    flows,
    status,
    error,
    totalReceived,
    startedAt,
    hardTimeoutMs,
    closedReason,
    start,
    stop,
    clear,
  };
}

type ParsedFrame =
  | { kind: 'data'; event: WirelogEvent }
  | { kind: 'error'; message: string }
  | { kind: 'meta'; hardTimeoutMs: number | null }
  | { kind: 'timeout'; message: string }
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
  let parsed: any;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return undefined; // ignore malformed frame
  }
  if (eventType === 'error') {
    return { kind: 'error', message: parsed.message || 'Stream error' };
  }
  if (eventType === 'meta') {
    return {
      kind: 'meta',
      hardTimeoutMs:
        typeof parsed.hardTimeoutMs === 'number' ? parsed.hardTimeoutMs : null,
    };
  }
  if (eventType === 'timeout') {
    return {
      kind: 'timeout',
      message: parsed.message || 'Stream stopped by server',
    };
  }
  if (parsed && typeof parsed === 'object' && parsed.flow) {
    return { kind: 'data', event: parsed as WirelogEvent };
  }
  return undefined;
}
