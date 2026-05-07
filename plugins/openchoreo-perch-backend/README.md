# @openchoreo/backstage-plugin-openchoreo-perch-backend

Node-side companion to the `openchoreo-perch` frontend plugin. Mounts at
`/api/openchoreo-perch-backend` on the Backstage backend and forwards
requests to the `assistant-agent` service in the OpenChoreo control
plane.

## What this plugin does

- **`POST /api/v1alpha1/assistant-agent/chat`** — streams ndjson
  upstream → response, byte-for-byte. Cancels the upstream fetch when
  the client disconnects mid-stream so a closed browser tab doesn't
  hold an LLM call open.
- **`POST /api/v1alpha1/assistant-agent/execute`** — non-streaming
  forward; returns the upstream JSON.
- **`POST /api/v1alpha1/assistant-agent/warmup`** — non-streaming
  forward; returns 202.

The plugin is a deliberate forwarder for now (see
`plugins/openchoreo-perch/README.md` "Why a backend plugin"). The
slots it reserves for future Backstage-side work are listed there;
nothing is wired today.

## Configuration

Reads the upstream URL in priority order:

1. `perch.assistantAgentUrl` (preferred, future-proof key)
2. `openchoreo.assistantAgentUrl` (current OpenChoreo convention)

When neither is set the plugin self-disables with an INFO log; the
frontend feature flag (`OPENCHOREO_FEATURES_ASSISTANT_ENABLED`) is the
primary gate.

```yaml
openchoreo:
  assistantAgentUrl: http://openchoreo-assistant-agent.openchoreo-control-plane.svc.cluster.local:8080
```

## Auth

Routes are registered with `allow: 'unauthenticated'` at the Backstage
backend layer. The **upstream** `assistant-agent` validates the
`Authorization: Bearer <JWT>` header itself against Thunder's JWKS and
runs its own `assistant:invoke` authz check; double-gating at the
Backstage layer would be redundant and would break service-account
tokens that don't carry a Backstage identity.

If you ever need to add Backstage-permission-framework gating, that is
the moment to flip `allow` to `'user'` and add a `requirePermission`
call inside `router.ts`.

## Streaming notes

- The `/chat` handler uses `Readable.fromWeb(upstream.body)` →
  `pipe(res)` so the WHATWG fetch stream stays as a stream all the way
  through.
- An `AbortController` ties the upstream fetch to the express
  request's `close` event. A tab close mid-stream propagates as a
  `signal: aborted` to the agent, which the agent uses to drop the
  in-flight LLM call.
- `Content-Length` / `Transfer-Encoding` / `Content-Encoding` are
  stripped from the upstream response before forwarding — Express
  recomputes whatever is correct for the chunked-pipe.
