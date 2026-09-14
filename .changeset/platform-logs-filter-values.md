---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
---

Populate the platform logs filter pickers from the observability plane rather than
from the log lines on screen.

Opening a picker now asks the plane which values that filter can take across every
record matching the current query, rather than only those the loaded page happened to
mention — so a pod that logged inside the time window is offered even when none of its
lines are on the page yet, and picking a namespace no longer leaves the namespace
picker showing that one value with no way back to the others. Each value carries how
many records use it, and typing narrows the list at the plane rather than in the
browser.

The plane is asked one filter at a time, and only for the picker being opened: each
answer costs it an aggregation, and a page view that never opens the filters costs
nothing.

A plane whose observer predates the endpoint, or whose logs module cannot aggregate,
falls back to the previous behaviour — values derived from the loaded log lines — with
no error, so the page behaves exactly as it did before against any existing
deployment.

The pickers, the label selector and the level select are no longer disabled while logs
are loading. That froze them during a "load more", which with per-picker values would
have blocked the very interaction that fetches them.
