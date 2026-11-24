---
'@openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo': minor
---

Add a Tech Insights fact retriever, `openchoreoAlertingFactRetriever`, that reports how many alert
rules are configured on each OpenChoreo Component's main line and release line, and lists, for each
environment the line is bound to, whether it is production, whether it has observability, and the
alerts and incidents of the last 30 days. Register it under `techInsights.factRetrievers`. The
counts need the portal's service credentials to hold `alerts:view` and `incidents:view`.
