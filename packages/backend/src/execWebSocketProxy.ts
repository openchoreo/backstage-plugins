import { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { execSessionStore } from '@openchoreo/backstage-plugin-backend';

/** Max bytes buffered from the client before the upstream socket opens. */
const MAX_PENDING_BYTES = 64 * 1024;

/** Byte length of a ws RawData frame (Buffer | ArrayBuffer | Buffer[]). */
function rawDataByteLength(data: WebSocket.RawData): number {
  if (Buffer.isBuffer(data)) return data.length;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (Array.isArray(data)) return data.reduce((n, b) => n + b.length, 0);
  return 0;
}

/**
 * Registers the WebSocket proxy for component exec sessions on the given
 * HTTP server.
 *
 * Why this lives outside the plugin:
 *   WebSocket upgrade handling requires direct access to the raw Node.js
 *   http.Server (server.on('upgrade', ...)), which is only available in
 *   rootHttpRouterServiceFactory's configure callback. The plugin itself
 *   cannot reach the server instance.
 *
 * Auth flow:
 *   1. Frontend calls POST /api/openchoreo/exec/init (HTTP) to exchange its
 *      IDP token for a short-lived sessionId.
 *   2. Frontend opens ws://.../api/openchoreo/exec/ws?sessionId=<uuid>.
 *      This function handles the upgrade, looks up the session, and proxies
 *      the connection to the OpenChoreo API using the stored token.
 */
export function registerExecWebSocketProxy(
  server: Server,
  config: RootConfigService,
  logger?: LoggerService,
): void {
  const log = logger;
  const baseUrl = config
    .getOptionalConfig('openchoreo')
    ?.getOptionalString('baseUrl');

  if (!baseUrl) return;

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      ws.close(1008, 'Missing sessionId');
      return;
    }

    const session = execSessionStore.consume(sessionId);
    if (!session) {
      ws.close(1008, 'Invalid or expired session');
      return;
    }

    // Build the upstream exec URL mirroring the OpenChoreo `occ` CLI's
    // buildExecWebSocketURL exactly (path + query param set + encoding), so the
    // server handler accepts the same shape it does for the CLI.
    //
    // The exec endpoint lives at the server root, not under /api/v1, so strip
    // the /api/v1 suffix that openchoreo.baseUrl carries.
    const wsBase = baseUrl.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '');
    const upstreamUrl = new URL(
      `${wsBase}/exec/namespaces/${encodeURIComponent(
        session.namespaceName,
      )}/components/${encodeURIComponent(session.componentName)}`,
    );
    const q = upstreamUrl.searchParams;
    if (session.projectName) q.set('project', session.projectName);
    if (session.environment) q.set('env', session.environment);
    if (session.podName) q.set('pod', session.podName);
    if (session.containerName) q.set('container', session.containerName);
    q.set('tty', 'true');
    q.set('stdin', 'true');
    q.set('command', '/bin/sh');

    // The token travels in the Authorization header, not the URL, so the URL is
    // safe to log as-is.
    log?.info(`exec: dialing upstream ${upstreamUrl.toString()}`);

    const upstream = new WebSocket(upstreamUrl.toString(), {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    // Buffer client → upstream frames until the upstream socket is open. The
    // browser sends the initial PTY resize frame immediately after our 101
    // (before the upstream handshake completes); without buffering that frame
    // would be dropped and the shell would start with no/zero PTY size.
    const pending: WebSocket.RawData[] = [];
    let pendingBytes = 0;
    let upstreamOpen = false;

    ws.on('message', data => {
      if (upstreamOpen && upstream.readyState === WebSocket.OPEN) {
        upstream.send(data);
        return;
      }
      // Bound the pre-open buffer: the legitimate payload here is the tiny
      // initial resize/stdin frame(s) during the sub-second handshake. A caller
      // spamming data before upstream opens must not grow memory unbounded.
      pendingBytes += rawDataByteLength(data);
      if (pendingBytes > MAX_PENDING_BYTES) {
        log?.error('exec: client exceeded pre-open buffer limit; closing');
        ws.close(1009, 'Buffered data limit exceeded before upstream open');
        return;
      }
      pending.push(data);
    });

    upstream.on('open', () => {
      upstreamOpen = true;
      for (const data of pending) {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(data);
        }
      }
      pending.length = 0;
    });

    upstream.on('message', data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // The upstream rejected the WS upgrade with an HTTP response (e.g. 401/403
    // from the exec handler's authz check). Surface the real status instead of
    // a generic error.
    upstream.on('unexpected-response', (_upReq, res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        if (body.length < 2048) body += chunk.toString();
      });
      res.on('end', () => {
        log?.error(
          `exec: upstream rejected upgrade — HTTP ${res.statusCode} ${
            res.statusMessage ?? ''
          } ${body.trim()}`,
        );
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1011, `Upstream rejected (${res.statusCode})`);
        }
      });
    });

    upstream.on('error', err => {
      log?.error(`exec: upstream connection error — ${err.message}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1011, 'Upstream connection error');
      }
    });

    upstream.on('close', (code, reason) => {
      log?.info(
        `exec: upstream closed — code ${code} reason "${
          reason?.toString() ?? ''
        }"`,
      );
      if (ws.readyState === WebSocket.OPEN) {
        // Only 1000 and 3000-4999 are valid to pass to WebSocket.close(); other
        // codes (e.g. 1006) would throw, so fall back to 1011.
        const safeCode =
          code === 1000 || (code >= 3000 && code <= 4999) ? code : 1011;
        ws.close(safeCode, reason);
      }
    });
    ws.on('close', (code, reason) => {
      // Tear the upstream down even mid-handshake, so an early client
      // disconnect can't leave an orphaned exec session dangling upstream.
      if (upstream.readyState === WebSocket.CONNECTING) {
        upstream.terminate();
      } else if (upstream.readyState === WebSocket.OPEN) {
        // Client close codes like 1005/1006 are invalid to forward; normalise.
        const safeCode =
          code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
        upstream.close(safeCode, reason);
      }
    });

    ws.on('error', () => {
      if (upstream.readyState === WebSocket.CONNECTING) {
        upstream.terminate();
      } else if (upstream.readyState === WebSocket.OPEN) {
        upstream.close();
      }
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/openchoreo/exec/ws') {
      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit('connection', ws, req);
      });
    }
  });
}
