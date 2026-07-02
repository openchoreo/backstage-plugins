import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';

export type SessionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface ExecConnectParams {
  namespaceName: string;
  projectName: string;
  componentName: string;
  environment: string;
  /** Target pod (Pod-node exec); omit for component/environment-level exec. */
  podName?: string;
  /** Target container within the pod; omit to use the upstream default. */
  containerName?: string;
}

export interface UseExecSessionResult {
  state: SessionState;
  errorMessage: string;
  connect: (params: ExecConnectParams) => Promise<void>;
  disconnect: () => void;
  sendData: (data: Uint8Array) => void;
  onData: (handler: (data: Uint8Array) => void) => void;
}

/**
 * Manages the lifecycle of an exec WebSocket session.
 *
 * Authentication flow:
 *   1. POST /exec/init (HTTP, fetchApi injects x-openchoreo-token automatically)
 *      → receives { sessionId }
 *   2. WS  /exec/ws?sessionId=<id>
 *      → backend looks up session, proxies to OpenChoreo API
 */
export function useExecSession(): UseExecSessionResult {
  const client = useApi(openChoreoClientApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const [state, setState] = useState<SessionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const dataHandlerRef = useRef<((data: Uint8Array) => void) | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setState('disconnected');
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, []);

  const connect = useCallback(
    async (params: ExecConnectParams) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setState('connecting');
      setErrorMessage('');

      let sessionId: string;
      try {
        const result = await client.execInit(params);
        sessionId = result.sessionId;
      } catch (err) {
        setState('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Failed to initialise exec session',
        );
        return;
      }

      // Build WebSocket URL — convert http(s):// to ws(s)://. Kept in the same
      // error path as execInit: a rejected getBaseUrl() or a synchronous
      // WebSocket construction error must surface as a terminal error state,
      // not leave the hook stuck in 'connecting' (unhandled rejection).
      let ws: WebSocket;
      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const wsUrl = `${baseUrl.replace(
          /^http/,
          'ws',
        )}/exec/ws?sessionId=${sessionId}`;
        ws = new WebSocket(wsUrl);
      } catch (err) {
        setState('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to open exec WebSocket',
        );
        return;
      }

      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      // Ignore callbacks from a socket that has since been superseded (e.g. by a
      // reconnect): only the current wsRef socket may mutate state / wsRef.
      ws.onopen = () => {
        if (wsRef.current !== ws) return;
        setState('connected');
      };

      ws.onmessage = event => {
        if (wsRef.current !== ws) return;
        if (dataHandlerRef.current) {
          dataHandlerRef.current(new Uint8Array(event.data as ArrayBuffer));
        }
      };

      // Local flag — avoids the stale `state` closure problem.
      // onerror fires before onclose on abnormal disconnects; the flag lets
      // onclose skip a redundant update without relying on captured state
      // values from a previous render cycle.
      let errorHandled = false;

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        errorHandled = true;
        setState('error');
        setErrorMessage('WebSocket connection error');
        wsRef.current = null;
      };

      ws.onclose = event => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        if (event.code === 1000 || event.code === 1001) {
          setState('disconnected');
        } else if (!errorHandled) {
          setState('error');
          setErrorMessage(
            event.reason || `Connection closed (code ${event.code})`,
          );
        }
      };
    },
    [client, discoveryApi],
  );

  const sendData = useCallback((data: Uint8Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const onData = useCallback((handler: (data: Uint8Array) => void) => {
    dataHandlerRef.current = handler;
  }, []);

  return { state, errorMessage, connect, disconnect, sendData, onData };
}
