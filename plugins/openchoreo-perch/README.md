# @openchoreo/backstage-plugin-openchoreo-perch

The Backstage frontend for **Perch** — the OpenChoreo AI assistant. Provides
the chat drawer, the global FAB, and the contextual launchers mounted on
component pages (failed-build snackbar, build-tab launcher, logs-tab "Ask
Perch" pill).

## Status: internal plugin

This plugin is part of the OpenChoreo Backstage app. It is **not** published
as a standalone Backstage plugin and has no third-party consumers — there
are no public extension points, no scaffolder actions, no permission rules.

The plugin shell exists for one reason: to register the
`assistantAgentApiRef` API factory through Backstage's idiomatic apiRef
pattern, so consumers do `useApi(assistantAgentApiRef)` instead of
constructing the client by hand.

UI components (`AssistantDrawerProvider` and the page-scoped launchers)
are exported as plain React components from `src/index.ts`. They are
**not** wrapped in `createComponentExtension`. Lazy-loading the leaf
launchers via the extension API would save ~5 KB of bundle that's
already on the critical path of every entity page; the indirection
costs more than it saves at this size. If a future component grows
large enough that lazy-loading matters, wrap that one specifically.

There is **no global "always-on" FAB**. Perch is surfaced by
contextual launchers on the pages where it can do useful work
(component build tab, runtime logs tab, the failed-build snackbar).
Mounting a global FAB invited the user into a chat that had no scope
and degraded the UX on pages where Perch can't act. If we ever want
a FAB again, scope it to specific routes rather than mounting it at
the app root.

## Mounting

```tsx
// packages/app/src/components/Root/Root.tsx
import { AssistantDrawerProvider } from '@openchoreo/backstage-plugin-openchoreo-perch';

<AssistantDrawerProvider>
  {/* app shell — the provider owns the chat drawer's open state and
      renders the drawer itself; mount it once at the app root so any
      launcher anywhere can call openDrawer({...}). */}
</AssistantDrawerProvider>;
```

```tsx
// packages/app/src/components/catalog/EntityPage.tsx
import {
  FailedBuildSnackbar,
  BuildPagePromptLauncher,
  LogsPageDebugPrompt,
} from '@openchoreo/backstage-plugin-openchoreo-perch';
```

The plugin is feature-gated by `openchoreo.features.assistant.enabled`
(env var `OPENCHOREO_FEATURES_ASSISTANT_ENABLED`); when disabled the
launchers and FAB render `null`. Note: the env var still says
`ASSISTANT` — the rename to `PERCH` is layer-2 work tracked separately
because it would break existing installs.

## Backend

The frontend talks to the `assistant-agent` service in the OpenChoreo
control plane through the **`openchoreo-perch-backend`** Node plugin
(see `plugins/openchoreo-perch-backend/`), which runs inside the
Backstage backend Express process and forwards requests upstream.

This matches the shape of the other OpenChoreo plugins
(`openchoreo-ci`, `openchoreo-observability`, `openchoreo-workflows`)
that all pair a frontend with a `*-backend` plugin resolved via
`discoveryApi.getBaseUrl('openchoreo-*-backend')`.

Configure the upstream in `app-config.yaml`:

```yaml
openchoreo:
  assistantAgentUrl: ${OPENCHOREO_ASSISTANT_AGENT_URL}
```

The backend plugin streams ndjson byte-for-byte for `/chat`, so the
LLM-call latency profile matches what you'd get from a direct hit. It
also forwards the `Authorization` header so the agent's own JWT/JWKS
validation and `assistant:invoke` authz check still gate access.

### Why a backend plugin (and not the proxy plugin)?

A backend plugin gives a consistent shape with the other OpenChoreo
plugins and a real place to add Backstage-side logic when it becomes a
product need. The current implementation is a thin forwarder; the
slots that justify the plugin (vs. just a proxy entry) are:

1. **Backstage permission framework gating** —
   `requirePermission()` middleware only works in backend plugins. To
   layer "this user/role can use Perch" on top of the agent's own
   `assistant:invoke` check, the rule lives here.
2. **Server-side scope enrichment** — fetching the catalog entity,
   resolving the project annotation, looking up the selected
   environment, and injecting them into the request before forwarding.
3. **Multi-backend routing** — selecting between Perch and a future
   on-prem model (or a Claude variant) per-org / per-user.
4. **Server-side rate limiting / quota** tied to Backstage identity.
5. **Backstage-identity-correlated audit logs** distinct from the
   agent's own user_sub-keyed logs.

None of those are wired today; the plugin is intentionally a forwarder
until one of them becomes a real driver. The point is that the
_plumbing_ is in place so adding any of the above is a localised
change in `plugins/openchoreo-perch-backend/` rather than a refactor.

## Out of scope (V1)

- Approving / executing proposed actions (`/execute` endpoint exists; UI
  for approve cards is a follow-up).
- Conversation persistence across page reloads.
- Multiple concurrent chats.
