---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-portal-app': minor
---

Add a centralized Platform Logs dashboard for logs from OpenChoreo's own
components, as a Logs tab under Platform. It filters on raw Kubernetes
coordinates — observability plane, cluster, namespace, pod, container, pod
labels, level, time range and message search — so a platform engineer can reach
any log the observability plane holds, including components OpenChoreo depends
on but does not ship.

A scope bar keeps the plane, time range, search, live tail and refresh visible;
the coordinate pickers, labels and log levels fold away behind a Filters button
and render as removable chips, so a collapsed row never hides what is narrowing
the query. The cluster, namespace, pod and container pickers are multi-select
and populated from the logs loaded so far, narrowing hierarchically as
selections are made, and stay free text because that pool comes from results
rather than a facet endpoint and is therefore never complete. The labels and
search fields are validated as you type, so a half-typed label selector is
explained on the field rather than sent and rejected. Expanding a row reveals
the full message, the pod's coordinates and its labels.

Every filter lives in the URL, so a filtered view is a shareable permalink.

Adds the cluster-scoped `openchoreo.platformlogs.view` permission and a
`usePlatformLogsPermission` hook for gating it. Unlike the component logs
permission this one takes no entity, because platform logs are not owned by any
project or component.
