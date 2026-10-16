# @openchoreo/backstage-plugin-openchoreo-portal-assistant

The Backstage frontend for **Perch** — the OpenChoreo AI assistant. Provides
the chat drawer and the contextual launchers mounted on component pages
(failed-build snackbar, deploy-panel and log-row "investigate" actions). There
is no global FAB — see "Status" below.

## Requirements

Requires [`@openchoreo/backstage-plugin`](../openchoreo) (the OpenChoreo
core plugin) to be installed in the same Backstage app. The core plugin
provides the fetch / permission / auth APIs this plugin uses.

## Status: internal plugin

This plugin is part of the OpenChoreo Backstage app. It is **not** published
as a standalone Backstage plugin and has no third-party consumers — there
are no public extension points, no scaffolder actions, no permission rules.

The plugin shell exists so consumers can do `useApi(perchAgentApiRef)`
instead of constructing the client by hand. Note that the `apis` array on
`openchoreoPerchPlugin` (`src/plugin.ts`) is **never read at runtime** — the
plugin registers no routable or component extension, so the loader never
visits it. The factory that actually gets wired lives in the alpha module
(`src/alpha.tsx`); removing it there causes `NotImplementedError` in
`AssistantDrawerProvider`.

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

Everything is wired by the package's **default export** from `./alpha` — a
`createFrontendModule({ pluginId: 'app' })` carrying the drawer wrapper, the
`perchAgentApiRef` factory, the `portalAssistantIntegrationApiRef` slots, and
the observability log-row action.

Because that is the _default_ export, the dependency is the whole installation.
The portal's `app` package has `app.packages: all` in `app-config.yaml`, so
frontend feature discovery installs the assistant with no `features` entry and
no import:

```yaml
app:
  packages: all
```

A host that does not use discovery installs the same export by hand:

```tsx
import assistantFeature from '@openchoreo/backstage-plugin-openchoreo-portal-assistant/alpha';

export default createPortalApp({ features: [assistantFeature] }).createRoot();
```

Keep it the _default_ export either way — discovery reads nothing else.

The wiring deliberately does **not** live in
`@openchoreo/backstage-portal-app`: this is a private plugin, and keeping it
out of the shell is what lets the shell be published. A portal that should not
ship the assistant drops the install.

The drawer mounts itself at the app root via `AppRootWrapperBlueprint`, so
hosts no longer wrap the shell in `<AssistantDrawerProvider>` by hand. The
remaining surfaces reach the host through `portalAssistantIntegrationApiRef`
(see `usePortalAssistant` in `@openchoreo/backstage-plugin-react`), which
renders nothing when no implementation is registered.

`BuildPagePromptLauncher` and `LogsPageDebugPrompt` are exported but currently
have no consumers — mount them yourself if you want those launchers.

The plugin is feature-gated by `openchoreo.features.assistant.enabled`
(env var `OPENCHOREO_FEATURES_ASSISTANT_ENABLED`); when disabled the
launchers render `null`. The `ASSISTANT` spelling is current: #559 renamed
this plugin _from_ Perch _to_ Portal Assistant, so the config key, plugin id
and apiRef id all read `portal-assistant`. Only internal TypeScript symbols
(`perchAgentApiRef`, `PerchAgentClient`, `PerchAgentApi`,
`openchoreoPerchPlugin`) still carry the old name; renaming those is cosmetic
and tracked separately. `perch-agent` in comments and config prose refers to
the upstream _service_, not to this plugin.

## Backend

The frontend talks to the `perch-agent` service in the OpenChoreo
control plane through the **`openchoreo-portal-assistant-backend`** Node plugin
(see `plugins/openchoreo-portal-assistant-backend/`), which runs inside the
Backstage backend Express process and forwards requests upstream.

This matches the shape of the other OpenChoreo plugins
(`openchoreo-ci`, `openchoreo-observability`, `openchoreo-workflows`)
that all pair a frontend with a `*-backend` plugin resolved via
`discoveryApi.getBaseUrl('openchoreo-*-backend')`.

Configure the upstream in `app-config.yaml`:

```yaml
openchoreo:
  portalAssistantUrl: ${OPENCHOREO_PORTAL_ASSISTANT_URL}
```

The backend plugin self-disables when that key is unset.

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
change in `plugins/openchoreo-portal-assistant-backend/` rather than a refactor.

## Out of scope (V1)

- Mutating tools — the agent is read-only. Use the OpenChoreo UI or
  CLI for writes.
- Conversation persistence across page reloads.
- Multiple concurrent chats.
