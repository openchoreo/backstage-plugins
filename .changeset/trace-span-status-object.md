---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/openchoreo-client-node': patch
---

Adapt the tracing views to the OpenTelemetry span status model. The
observability API now returns a span's `status` as a `SpanStatus` object
(`code` of `ok`/`error`/`unset` plus an optional `message`) instead of a plain
status string. The waterfall tooltip now shows the span's status code, the span
details panel gains a dedicated Status section (alongside Attributes and Resource
Attributes) that surfaces the status message, and error spans stay highlighted
based on the status code. This also prevents the span tooltip from crashing when
the status is an object.
