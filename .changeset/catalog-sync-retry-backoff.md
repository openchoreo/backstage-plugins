---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
'@openchoreo/openchoreo-auth': patch
'@openchoreo/backstage-plugin-common': patch
---

Recover the OpenChoreo catalog sync quickly after a failed run instead of waiting a full sync interval. Previously a failure (e.g. the IdP/API being briefly unreachable during a cluster cold start) aborted the periodic full sync, leaving the catalog empty until the next scheduled run (default 5 minutes) later.

The entity provider now retries a failed sync with capped exponential backoff — starting at `openchoreo.schedule.retryInterval` (new, default 30s) and doubling on each consecutive failure up to `schedule.frequency` — so it recovers within ~30s of the backend returning, backs off gracefully during a sustained outage instead of hammering, and never stops reconciling (the catalog self-heals whenever the backend comes back).

Client-credentials token acquisition also retries transient failures (network errors and 5xx, but not 4xx) with exponential backoff, and the catalog API client now fails fast when a service token cannot be obtained rather than silently issuing unauthenticated requests that are guaranteed to 401.
