---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-platform-engineer-core': minor
---

Add a centralized Platform Logs dashboard for everything an observability plane
collects — OpenChoreo's own system components included — as a Logs tab under
Platform. It filters on raw Kubernetes
coordinates — observability plane, cluster, namespace, pod, container, pod
labels, level, time range and message search — so a platform engineer can reach
any log the observability plane holds, including components OpenChoreo depends
on but does not ship.

A scope bar keeps the plane, time range, search, live tail and refresh visible;
the coordinate pickers, labels and log levels fold away behind a Filters button
and render as removable chips, so a collapsed row never hides what is narrowing
the query. The cluster, namespace, pod and container pickers are multi-select
and ask the observability plane for their values when opened, so they offer
everything the current query matches rather than only what is on screen. They
stay free text because that list is still bounded - by the time window, and by
the values carrying the most records. The labels and
search fields are validated as you type, so a half-typed label selector is
explained on the field rather than sent and rejected. Expanding a row reveals
the full message, the pod's coordinates and its labels.

Every filter lives in the URL, so a filtered view is a shareable permalink.

Adds the cluster-scoped `openchoreo.platformlogs.view` permission and a
`usePlatformLogsPermission` hook for gating it. Unlike the component logs
permission this one takes no entity, because platform logs are not owned by any
project or component.

The Platform section is assembled through Backstage's own sub-page mechanism
rather than a shared shell component. `page:platform-engineer-core/platform-overview`
is now a container page that renders whatever tabs are attached to its `pages`
input, so any plugin can contribute a Platform tab with a `SubPageBlueprint`
pointed at that id — no dependency on the platform-engineer-core package needed.
The Logs tab is the first example, and ships as
`sub-page:openchoreo-observability/platform-logs` (it was
`page:openchoreo-observability/platform-logs`; that is the id to use when
disabling or reconfiguring it under `app.extensions`).

The section's chrome now comes from the portal's `core.page-layout` rather than a
shell each tab mounted for itself, so the header and tab bar render once for the
whole section instead of remounting on every tab switch. It looks the same: a
tabbed page keeps the portal's standard `<Header>` rather than picking up
Backstage's own toolbar, and switching tabs still carries the query string, so a
round trip between tabs preserves the filters each had set. The only thing lost is
the per-tab header subtitle.

The Overview tab now lives at `/platform-overview/overview`; the bare
`/platform-overview` still works and redirects there.
