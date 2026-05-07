import { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';

export interface RouterOptions {
  logger: LoggerService;
  /**
   * Base URL of the upstream assistant-agent service, e.g.
   * ``http://openchoreo-assistant-agent.openchoreo-control-plane.svc.cluster.local:8080``.
   * The trailing ``/api/v1alpha1/assistant-agent/...`` path segments are
   * appended per-route.
   */
  targetUrl: string;
  /**
   * Hard timeout (ms) for non-streaming forwards (`/warmup`, `/execute`).
   * Aborts the upstream fetch after this elapsed time. Default 30 s —
   * matches typical Backstage backend route timeouts and lets a wedged
   * upstream bail in time for the browser to show a real error rather
   * than a stuck spinner.
   */
  upstreamTimeoutMs?: number;
  /**
   * Hard timeout (ms) for the streaming `/chat` forward, applied across
   * the entire request lifetime (initial connection + stream pipe).
   * Generous on purpose: an LLM turn with multiple tool calls
   * routinely takes 1-3 minutes; this is a backstop against an upstream
   * that goes silent forever, NOT a per-token deadline. Default 10 min.
   */
  streamTimeoutMs?: number;
}

const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 600_000;

interface ForwardCtx {
  logger: LoggerService;
  targetUrl: string;
  upstreamTimeoutMs: number;
  streamTimeoutMs: number;
}

/**
 * Routes registered by this plugin (mounted at /api/openchoreo-perch-backend):
 *
 *   POST  /api/v1alpha1/assistant-agent/chat       (streaming ndjson)
 *   POST  /api/v1alpha1/assistant-agent/execute    (small JSON)
 *   POST  /api/v1alpha1/assistant-agent/warmup     (small JSON, 202)
 *
 * The frontend's ``AssistantAgentClient`` calls
 * ``discoveryApi.getBaseUrl('openchoreo-perch-backend') + '/api/v1alpha1/...'``,
 * so these paths must match the agent's own route prefix exactly.
 */
export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const ctx: ForwardCtx = {
    logger: options.logger,
    targetUrl: options.targetUrl,
    upstreamTimeoutMs: options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS,
    streamTimeoutMs: options.streamTimeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS,
  };
  const router = Router();
  router.use(express.json({ limit: '128kb' }));

  // Three streaming-aware forwarders.
  router.post('/api/v1alpha1/assistant-agent/chat', async (req, res) => {
    await forwardStream(req, res, '/chat', ctx);
  });
  router.post('/api/v1alpha1/assistant-agent/execute', async (req, res) => {
    await forwardJson(req, res, '/execute', ctx);
  });
  router.post('/api/v1alpha1/assistant-agent/warmup', async (req, res) => {
    await forwardJson(req, res, '/warmup', ctx);
  });

  return router;
}

/** Did the fetch reject because of an AbortSignal.timeout()?
 *
 * Node's fetch (undici) throws a ``DOMException`` with ``name ===
 * "TimeoutError"`` when AbortSignal.timeout fires. We duck-type on the
 * ``name`` property rather than ``instanceof Error`` because jest's
 * test realm and Node's main realm can have different DOMException
 * prototypes; the name string is realm-independent and stable.
 *
 * Composed signals (AbortSignal.any) may surface the TimeoutError on
 * ``err.cause`` instead of the outer error, depending on Node version
 * — we check both so a future runtime upgrade doesn't silently flip
 * our 504 GATEWAY_TIMEOUT responses into 502 BAD_GATEWAY.
 */
function isTimeoutError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: unknown; message?: unknown; cause?: unknown };
  if (e.name === 'TimeoutError') return true;
  const cause = e.cause as { name?: unknown } | undefined;
  if (cause && cause.name === 'TimeoutError') return true;
  // Fallback for AbortError-shaped wrappers — undici sometimes surfaces
  // "The operation was aborted due to timeout" verbatim without
  // preserving the TimeoutError name on the outer error.
  if (
    e.name === 'AbortError' &&
    typeof e.message === 'string' &&
    /timeout/i.test(e.message)
  ) {
    return true;
  }
  return false;
}

/**
 * Headers we always strip from upstream responses before sending to
 * the browser — would corrupt the chunked-pipe semantics if forwarded.
 */
const STRIP_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'transfer-encoding',
  'content-length',
]);

/**
 * Tight allowlist of inbound headers we forward to the assistant-agent.
 *
 * Why a whitelist (and not a blacklist of "sensitive" headers): a
 * blacklist trains the next contributor to add new sensitive headers
 * to the strip-set whenever Backstage or the browser introduces one,
 * and inevitably leaks something. With a whitelist the failure mode is
 * "a useful header didn't reach the upstream" — visible, fixable. With
 * a blacklist the failure mode is "a Cookie / X-Backstage-* / internal
 * correlation header reached the upstream and was logged or replayed
 * by mistake" — silent and security-relevant.
 *
 * Specifically excluded by being absent from this list: ``cookie``
 * (session bleed), every ``x-forwarded-*`` (path leakage), Backstage's
 * internal correlation headers, browser hint headers (``sec-*``,
 * ``referer``), proxy-control headers (``via``, ``forwarded``).
 */
const FORWARD_HEADER_ALLOWLIST = new Set([
  'authorization',
  'accept',
  'accept-language',
  'content-type',
  'user-agent',
]);

interface ForwardHeaders {
  /** Headers ready to pass to fetch(). */
  headers: Record<string, string>;
  /** The effective request id — caller-supplied if present, otherwise
   *  the locally-generated one. Single source of truth: error
   *  responses, log lines and the upstream all carry the same value. */
  requestId: string;
}

function buildForwardHeaders(req: express.Request): ForwardHeaders {
  const out: Record<string, string> = {};
  for (const name of FORWARD_HEADER_ALLOWLIST) {
    const v = req.headers[name];
    if (Array.isArray(v)) {
      out[name] = v.join(', ');
    } else if (typeof v === 'string' && v.length > 0) {
      out[name] = v;
    }
  }
  // Force JSON content-type on the inbound side; the express.json()
  // middleware already parsed the body so we re-serialise it below.
  out['content-type'] = 'application/json';
  // X-Request-ID is correlation, not sensitive — pass through if the
  // caller sent one, otherwise synthesise. Returned alongside the
  // headers so callers can use ONE id for logs, error responses, and
  // the upstream call without re-reading req.headers separately.
  const inboundRid = req.headers['x-request-id'];
  const requestId =
    typeof inboundRid === 'string' && inboundRid.length > 0
      ? inboundRid
      : randomUUID().replace(/-/g, '').slice(0, 12);
  out['x-request-id'] = requestId;
  return { headers: out, requestId };
}

function applyResponseHeaders(
  upstreamHeaders: Headers,
  res: express.Response,
): void {
  upstreamHeaders.forEach((value, key) => {
    if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
}

/**
 * Streaming forwarder for the ndjson ``/chat`` endpoint. Pipes the
 * upstream body byte-for-byte; never buffers. Cancels the upstream
 * fetch if the client disconnects mid-stream so we don't leak a
 * connection holding an LLM call open after the user navigated away.
 */
async function forwardStream(
  req: express.Request,
  res: express.Response,
  upstreamPath: string,
  ctx: ForwardCtx,
): Promise<void> {
  const { logger, targetUrl, streamTimeoutMs } = ctx;
  const url = `${targetUrl.replace(
    /\/$/,
    '',
  )}/api/v1alpha1/assistant-agent${upstreamPath}`;
  // Build request headers FIRST — the returned requestId is the single
  // source of truth used by every subsequent log line, error envelope,
  // and the upstream call itself. Pre-buildForwardHeaders the local
  // log fallback diverged from the upstream id when the caller didn't
  // send X-Request-ID.
  const { headers: forwardHeaders, requestId } = buildForwardHeaders(req);

  // AbortController to tear down the upstream fetch when the client
  // disconnects mid-stream. We wire it to ``res.on('close')`` (NOT
  // ``req.on('close')``): in Node's HTTP server, ``req.close`` fires
  // when the request body has been fully read — which happens BEFORE
  // we get a chance to call fetch — so wiring abort there cancels the
  // upstream before it ever launches and every call returns 502. The
  // ``res.close`` event fires only when the response connection
  // terminates (either we ended it or the client hung up), which is
  // what we actually want.
  const clientAbort = new AbortController();
  let upstreamSettled = false;
  const onResClose = () => {
    if (!upstreamSettled && !res.writableEnded) {
      logger.info(
        `perch-backend: client closed before stream end rid=${requestId} path=${upstreamPath}`,
      );
      clientAbort.abort();
    }
  };
  res.on('close', onResClose);

  // Compose the per-request abort with a hard upstream-side deadline.
  // ``AbortSignal.any`` (Node ≥ 18.17 / 20.3) fires when EITHER child
  // signal fires — client-disconnect OR streamTimeoutMs elapsed.
  // Without this, a wedged upstream that never sends the FIN packet
  // would hold the request open as long as the OS keeps the socket
  // alive (potentially hours, until idle-timeout).
  const fetchSignal = AbortSignal.any([
    clientAbort.signal,
    AbortSignal.timeout(streamTimeoutMs),
  ]);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body ?? {}),
      signal: fetchSignal,
    });
  } catch (err) {
    res.off('close', onResClose);
    const timedOut = isTimeoutError(err);
    logger.error(
      `perch-backend: upstream fetch ${timedOut ? 'timed out' : 'failed'} ` +
        `rid=${requestId} path=${upstreamPath} ` +
        `(streamTimeoutMs=${streamTimeoutMs}): ${(err as Error).message}`,
    );
    if (!res.headersSent) {
      if (timedOut) {
        res.status(504).json({
          error: 'GATEWAY_TIMEOUT',
          message: `Upstream did not respond within ${streamTimeoutMs} ms`,
          request_id: requestId,
        });
      } else {
        res.status(502).json({
          error: 'BAD_GATEWAY',
          message: 'Failed to reach assistant-agent',
          request_id: requestId,
        });
      }
    }
    return;
  }

  res.status(upstream.status);
  applyResponseHeaders(upstream.headers, res);

  if (!upstream.body) {
    res.end();
    res.off('close', onResClose);
    upstreamSettled = true;
    return;
  }

  // Convert the WHATWG ReadableStream to a Node Readable so we can pipe
  // through Express's response. Readable.fromWeb is in Node ≥ 17, which
  // Backstage requires.
  const nodeStream = Readable.fromWeb(upstream.body as never);
  try {
    nodeStream.pipe(res);
    await new Promise<void>((resolve, reject) => {
      nodeStream.on('end', () => {
        upstreamSettled = true;
        resolve();
      });
      nodeStream.on('error', err => {
        upstreamSettled = true;
        reject(err);
      });
      // res.close also resolves the promise — pipe ends cleanly when
      // the client hangs up.
      res.on('close', () => {
        upstreamSettled = true;
        resolve();
      });
    });
  } catch (err) {
    // Distinguish three causes:
    //   - client disconnected mid-stream (clientAbort) — expected, no log
    //   - upstream wall-clock timeout — warn with the configured ms value
    //   - any other pipe error — warn with the raw message
    if (clientAbort.signal.aborted) {
      // already logged in onResClose
    } else if (isTimeoutError(err)) {
      logger.warn(
        `perch-backend: stream timed out rid=${requestId} path=${upstreamPath} ` +
          `(streamTimeoutMs=${streamTimeoutMs})`,
      );
    } else {
      logger.warn(
        `perch-backend: stream error rid=${requestId} path=${upstreamPath}: ${
          (err as Error).message
        }`,
      );
    }
  } finally {
    res.off('close', onResClose);
  }
}

/**
 * Non-streaming forwarder for ``/execute`` and ``/warmup``. Reads the
 * full upstream body and relays it as JSON. Same body-shape as a
 * passthrough — no transformation.
 */
async function forwardJson(
  req: express.Request,
  res: express.Response,
  upstreamPath: string,
  ctx: ForwardCtx,
): Promise<void> {
  const { logger, targetUrl, upstreamTimeoutMs } = ctx;
  const url = `${targetUrl.replace(
    /\/$/,
    '',
  )}/api/v1alpha1/assistant-agent${upstreamPath}`;
  // Single source of truth for the request id — forwarded to upstream
  // AND echoed in any error envelope below.
  const { headers: forwardHeaders, requestId } = buildForwardHeaders(req);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body ?? {}),
      // Hard wall-clock deadline. Without this, a wedged upstream pins
      // this request until the OS-level idle-timeout kicks in, which
      // can be tens of minutes — long enough that the browser has long
      // since shown a stuck spinner.
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });
  } catch (err) {
    const timedOut = isTimeoutError(err);
    logger.error(
      `perch-backend: upstream fetch ${timedOut ? 'timed out' : 'failed'} ` +
        `rid=${requestId} path=${upstreamPath} ` +
        `(upstreamTimeoutMs=${upstreamTimeoutMs}): ${(err as Error).message}`,
    );
    if (timedOut) {
      res.status(504).json({
        error: 'GATEWAY_TIMEOUT',
        message: `Upstream did not respond within ${upstreamTimeoutMs} ms`,
        request_id: requestId,
      });
    } else {
      res.status(502).json({
        error: 'BAD_GATEWAY',
        message: 'Failed to reach assistant-agent',
        request_id: requestId,
      });
    }
    return;
  }

  res.status(upstream.status);
  applyResponseHeaders(upstream.headers, res);
  const text = await upstream.text();
  if (text) {
    res.send(text);
  } else {
    res.end();
  }
}
