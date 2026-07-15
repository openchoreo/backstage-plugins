---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Fix trace span details never loading from cache. The span cache key included
the filter scope and time window, whose timestamps changed every render, so the
key used to read spans (`getSpans`) no longer matched the one they were cached
under and always returned `undefined`. Spans are now keyed by trace id alone —
a trace id uniquely identifies its spans regardless of the query scope.
