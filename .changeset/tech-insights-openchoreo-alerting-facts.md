---
'@openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo': minor
---

Add a Tech Insights fact retriever, `openchoreoAlertingFactRetriever`, that reports how many alert
rules are configured on each OpenChoreo Component's main line and release line, and lists, for each
environment the line is bound to, whether it is production, whether it has observability, and the
alerts and incidents of the last 30 days. `openchoreoAlertCountsResolved` is reported only when
at least one environment has observability and every such environment returned all its counts, so a check that requires it skips
rather than passing on partial counts. An observer that times out (10 seconds per query) or can't
be reached is skipped until the next run. Register it under `techInsights.factRetrievers`. The
counts need the portal's service credentials to hold `alerts:view` and `incidents:view`.
