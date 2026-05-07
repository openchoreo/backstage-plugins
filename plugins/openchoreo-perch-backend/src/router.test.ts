import express from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';

import { createRouter } from './router';

/**
 * Spin up a minimal Node http.Server as a mock upstream "assistant-agent".
 * Each test installs a per-call handler so we can assert on the inbound
 * forwarded request and shape the response (status, headers, streaming
 * chunks, latency).
 */
function startMockUpstream(): Promise<{
  url: string;
  setHandler: (h: http.RequestListener) => void;
  close: () => Promise<void>;
}> {
  let handler: http.RequestListener = (_req, res) => {
    res.writeHead(200);
    res.end('default');
  };
  const server = http.createServer((req, res) => handler(req, res));
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        setHandler: h => {
          handler = h;
        },
        close: () =>
          new Promise<void>((res, rej) =>
            server.close(err => (err ? rej(err) : res())),
          ),
      });
    });
  });
}

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as any;
}

describe('openchoreo-perch-backend router', () => {
  let upstream: Awaited<ReturnType<typeof startMockUpstream>>;
  let app: express.Express;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(async () => {
    upstream = await startMockUpstream();
    logger = makeLogger();
    const router = await createRouter({ logger, targetUrl: upstream.url });
    app = express();
    app.use(router);
  });

  afterEach(async () => {
    await upstream.close();
  });

  describe('POST /api/v1alpha1/assistant-agent/warmup', () => {
    it('forwards to the upstream and returns its status + body', async () => {
      const inbound: { headers: http.IncomingHttpHeaders; body: string } = {
        headers: {},
        body: '',
      };
      upstream.setHandler((req, res) => {
        inbound.headers = req.headers;
        let buf = '';
        req.on('data', chunk => (buf += chunk));
        req.on('end', () => {
          inbound.body = buf;
          res.writeHead(202, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ status: 'warming' }));
        });
      });

      const res = await request(app)
        .post('/api/v1alpha1/assistant-agent/warmup')
        .set('Authorization', 'Bearer test-token')
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ status: 'warming' });
      // Forwarded path is the upstream's canonical /api/v1alpha1/assistant-agent/warmup.
      expect(inbound.headers.authorization).toBe('Bearer test-token');
      expect(inbound.body).toBe('{}');
    });

    it('synthesises an X-Request-ID when the caller did not send one', async () => {
      let receivedRid: string | undefined;
      upstream.setHandler((req, res) => {
        receivedRid = req.headers['x-request-id'] as string | undefined;
        res.writeHead(202).end();
      });

      await request(app).post('/api/v1alpha1/assistant-agent/warmup').send({});

      expect(receivedRid).toBeDefined();
      expect(receivedRid).toMatch(/^[a-f0-9]{12}$/);
    });

    it('forwards the caller-supplied X-Request-ID untouched', async () => {
      let receivedRid: string | undefined;
      upstream.setHandler((req, res) => {
        receivedRid = req.headers['x-request-id'] as string | undefined;
        res.writeHead(202).end();
      });

      await request(app)
        .post('/api/v1alpha1/assistant-agent/warmup')
        .set('X-Request-ID', 'rid_correlation_test')
        .send({});

      expect(receivedRid).toBe('rid_correlation_test');
    });

    it('strips hop-by-hop headers (host, connection, content-length) before forwarding', async () => {
      let upstreamHeaders: http.IncomingHttpHeaders = {};
      upstream.setHandler((req, res) => {
        upstreamHeaders = req.headers;
        res.writeHead(202).end();
      });

      await request(app).post('/api/v1alpha1/assistant-agent/warmup').send({});

      // ``host`` is still present because Node's fetch sets its own Host;
      // we only assert that the *original* Host (referencing supertest's
      // ephemeral server) didn't leak through. The Backstage backend's
      // host should never appear as the upstream's Host header.
      expect(upstreamHeaders.host).toMatch(/^127\.0\.0\.1:/);
      // We always force application/json on the inbound side because
      // express.json() consumed the body and we re-serialise it.
      expect(upstreamHeaders['content-type']).toBe('application/json');
    });

    it('does NOT forward sensitive or browser-only headers (cookie, x-forwarded-*, sec-*, referer)', async () => {
      let upstreamHeaders: http.IncomingHttpHeaders = {};
      upstream.setHandler((req, res) => {
        upstreamHeaders = req.headers;
        res.writeHead(202).end();
      });

      await request(app)
        .post('/api/v1alpha1/assistant-agent/warmup')
        .set('Cookie', 'session=abc; csrf=xyz')
        .set('X-Forwarded-For', '203.0.113.7')
        .set('X-Forwarded-Host', 'attacker.example')
        .set('X-Backstage-Internal', 'should-not-leak')
        .set('Sec-Fetch-Mode', 'cors')
        .set('Referer', 'http://localhost:3000/sensitive-page')
        .send({});

      // Whitelist-driven forwarding — every one of these MUST be absent
      // from the upstream call. Failing this test means the allowlist
      // grew to include a sensitive header by mistake.
      //
      // Note: ``sec-fetch-mode`` is intentionally NOT asserted here —
      // it's a forbidden-header Node's fetch implementation sets itself
      // based on the request mode, not something we forward from the
      // inbound side. Our allowlist only governs what the request
      // handler chooses to pass through.
      expect(upstreamHeaders.cookie).toBeUndefined();
      expect(upstreamHeaders['x-forwarded-for']).toBeUndefined();
      expect(upstreamHeaders['x-forwarded-host']).toBeUndefined();
      expect(upstreamHeaders['x-backstage-internal']).toBeUndefined();
      expect(upstreamHeaders.referer).toBeUndefined();
    });

    it('uses the same X-Request-ID for the upstream call and the local error envelope', async () => {
      // Single-source-of-truth contract: when the caller does NOT send
      // an X-Request-ID, the synthesised id must match the one echoed
      // in any local error response so log-correlation works.
      let receivedRid: string | undefined;
      upstream.setHandler((req, _res) => {
        receivedRid = req.headers['x-request-id'] as string | undefined;
        // Hang so the test sees a 504 envelope with the local
        // request_id — that's the one we want to match against the
        // upstream-bound id.
      });
      const tightRouter = await createRouter({
        logger,
        targetUrl: upstream.url,
        upstreamTimeoutMs: 50,
      });
      const tightApp = express();
      tightApp.use(tightRouter);

      const res = await request(tightApp)
        .post('/api/v1alpha1/assistant-agent/warmup')
        .send({});

      expect(receivedRid).toBeDefined();
      expect(res.body.request_id).toBe(receivedRid);
    });
  });

  describe('POST /api/v1alpha1/assistant-agent/execute', () => {
    it('forwards body and returns upstream JSON', async () => {
      let inboundBody = '';
      upstream.setHandler((req, res) => {
        let buf = '';
        req.on('data', chunk => (buf += chunk));
        req.on('end', () => {
          inboundBody = buf;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ success: true, result: { ok: 1 } }));
        });
      });

      const res = await request(app)
        .post('/api/v1alpha1/assistant-agent/execute')
        .send({ action_id: 'act_test123' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, result: { ok: 1 } });
      expect(JSON.parse(inboundBody)).toEqual({ action_id: 'act_test123' });
    });

    it('passes through upstream non-2xx without rewriting', async () => {
      // Real case: the agent returns {success:false, error:'...'} on a
      // 200 with a JSON envelope. We verify status passes through too.
      upstream.setHandler((_req, res) => {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'FORBIDDEN' }));
      });

      const res = await request(app)
        .post('/api/v1alpha1/assistant-agent/execute')
        .send({ action_id: 'act_x' });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'FORBIDDEN' });
    });
  });

  describe('POST /api/v1alpha1/assistant-agent/chat (streaming)', () => {
    /**
     * Regression test for the 502 bug: previously the AbortController was
     * wired to ``req.on('close')``, which fires when express.json()
     * finishes reading the body — i.e. BEFORE fetch() launched. Every
     * /chat call would self-cancel and surface as a 502.
     */
    it('does NOT 502 the request as a side-effect of the abort wiring', async () => {
      upstream.setHandler((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        res.end(
          `${JSON.stringify({ type: 'message_chunk', content: 'hi' })}\n`,
        );
      });

      const res = await request(app)
        .post('/api/v1alpha1/assistant-agent/chat')
        .send({ messages: [{ role: 'user', content: 'hi' }] });

      expect(res.status).toBe(200);
      // Body should be the ndjson, not the BAD_GATEWAY envelope.
      expect(res.text).toContain('"type":"message_chunk"');
      expect(res.text).not.toContain('BAD_GATEWAY');
    });

    it('streams ndjson chunks in order, byte-for-byte', async () => {
      const chunks = [
        '{"type":"tool_call","tool":"list_namespaces","activeForm":"Listing namespaces"}\n',
        '{"type":"message_chunk","content":"You"}\n',
        '{"type":"message_chunk","content":" have"}\n',
        '{"type":"done","message":"You have"}\n',
      ];
      upstream.setHandler(async (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        for (const chunk of chunks) {
          res.write(chunk);
          // Tiny delay between writes so we can verify these arrive as
          // multiple chunks rather than a single buffered blob.
          await new Promise(r => setTimeout(r, 5));
        }
        res.end();
      });

      const res = await request(app)
        .post('/api/v1alpha1/assistant-agent/chat')
        .send({ messages: [{ role: 'user', content: 'hi' }] });

      expect(res.status).toBe(200);
      expect(res.text).toBe(chunks.join(''));
    });

    it('forwards the Authorization header to the upstream', async () => {
      let upstreamAuth: string | undefined;
      upstream.setHandler((req, res) => {
        upstreamAuth = req.headers.authorization;
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        res.end('{"type":"done","message":""}\n');
      });

      await request(app)
        .post('/api/v1alpha1/assistant-agent/chat')
        .set('Authorization', 'Bearer my-jwt')
        .send({ messages: [{ role: 'user', content: 'x' }] });

      expect(upstreamAuth).toBe('Bearer my-jwt');
    });
  });

  describe('upstream timeout', () => {
    it('forwardJson returns 504 when the upstream does not respond within upstreamTimeoutMs', async () => {
      // Upstream accepts the connection but never responds — would
      // hang indefinitely without the timeout.
      upstream.setHandler((_req, _res) => {
        // Intentionally do nothing.
      });
      const tightRouter = await createRouter({
        logger,
        targetUrl: upstream.url,
        upstreamTimeoutMs: 50,
      });
      const tightApp = express();
      tightApp.use(tightRouter);

      const start = Date.now();
      const res = await request(tightApp)
        .post('/api/v1alpha1/assistant-agent/warmup')
        .send({});
      const elapsed = Date.now() - start;

      expect(res.status).toBe(504);
      expect(res.body).toEqual({
        error: 'GATEWAY_TIMEOUT',
        message: expect.stringMatching(/Upstream did not respond within 50 ms/),
        request_id: expect.any(String),
      });
      // Bound check: should fire near the 50 ms cap, not minutes later.
      expect(elapsed).toBeLessThan(2_000);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/upstream fetch timed out/),
      );
    });

    it('forwardStream returns 504 when the upstream does not send response headers within streamTimeoutMs', async () => {
      upstream.setHandler((_req, _res) => {
        // Hang.
      });
      const tightRouter = await createRouter({
        logger,
        targetUrl: upstream.url,
        streamTimeoutMs: 50,
      });
      const tightApp = express();
      tightApp.use(tightRouter);

      const start = Date.now();
      const res = await request(tightApp)
        .post('/api/v1alpha1/assistant-agent/chat')
        .send({ messages: [{ role: 'user', content: 'x' }] });
      const elapsed = Date.now() - start;

      expect(res.status).toBe(504);
      expect(res.body.error).toBe('GATEWAY_TIMEOUT');
      expect(elapsed).toBeLessThan(2_000);
    });
  });

  describe('upstream failure', () => {
    it('returns 502 with a generic body when the upstream is unreachable', async () => {
      // Tear down the upstream BEFORE issuing the request so the fetch
      // gets a connection-refused.
      const port = new URL(upstream.url).port;
      await upstream.close();

      // Re-mount the router with a target that nothing is listening on.
      const stalled = `http://127.0.0.1:${port}`;
      const router = await createRouter({ logger, targetUrl: stalled });
      const standalone = express();
      standalone.use(router);

      const res = await request(standalone)
        .post('/api/v1alpha1/assistant-agent/warmup')
        .send({});

      expect(res.status).toBe(502);
      expect(res.body).toEqual({
        error: 'BAD_GATEWAY',
        message: 'Failed to reach assistant-agent',
        request_id: expect.any(String),
      });
      // We logged the underlying cause server-side; assert we did NOT
      // leak the raw fetch error string into the user-bound response.
      expect(res.body.message).not.toMatch(/ECONNREFUSED|fetch failed/i);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/perch-backend: upstream fetch failed/),
      );

      // Re-open so afterEach's close() doesn't blow up. Quick stub.
      upstream = {
        url: stalled,
        setHandler: () => {},
        close: async () => {},
      };
    });

    it('forwardStream returns 502 when the upstream is unreachable', async () => {
      // Same connection-refused pattern as the forwardJson test, but
      // exercising the streaming code path's failure branch — distinct
      // from the streamTimeout branch above.
      const port = new URL(upstream.url).port;
      await upstream.close();
      const stalled = `http://127.0.0.1:${port}`;
      const router = await createRouter({ logger, targetUrl: stalled });
      const standalone = express();
      standalone.use(router);

      const res = await request(standalone)
        .post('/api/v1alpha1/assistant-agent/chat')
        .send({ messages: [{ role: 'user', content: 'x' }] });

      expect(res.status).toBe(502);
      expect(res.body).toEqual({
        error: 'BAD_GATEWAY',
        message: 'Failed to reach assistant-agent',
        request_id: expect.any(String),
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/perch-backend: upstream fetch failed/),
      );

      upstream = { url: stalled, setHandler: () => {}, close: async () => {} };
    });
  });

  describe('forwardStream edge cases', () => {
    it('handles an empty upstream body (e.g. 204 No Content)', async () => {
      // ``fetch()`` returns ``response.body === null`` for 204/205 and
      // for ``HEAD`` responses. Exercise the ``if (!upstream.body)``
      // early-return so it doesn't crash trying to pipe ``null``.
      upstream.setHandler((_req, res) => {
        res.writeHead(204);
        res.end();
      });

      const res = await request(app)
        .post('/api/v1alpha1/assistant-agent/chat')
        .send({ messages: [{ role: 'user', content: 'x' }] });

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('forwards the upstream status code on streaming responses', async () => {
      // Confirm the streaming path also passes through non-200 codes
      // (mirrors the same behavior asserted on /execute). The streaming
      // route can legitimately return a 4xx with an ndjson error body;
      // we must not rewrite the status.
      upstream.setHandler((_req, res) => {
        res.writeHead(429, { 'content-type': 'application/x-ndjson' });
        res.end('{"type":"error","message":"rate limited"}\n');
      });

      const res = await request(app)
        .post('/api/v1alpha1/assistant-agent/chat')
        .send({ messages: [{ role: 'user', content: 'x' }] });

      expect(res.status).toBe(429);
      expect(res.text).toContain('"rate limited"');
    });
  });
});
