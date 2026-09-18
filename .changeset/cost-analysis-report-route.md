---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Fix "View report" in Cost Insights → Analysis Reports, which showed an empty Insights tab instead of the report. The tab's nested route now accepts the report id, the report link carries the query string that holds the selected project and environment, and the Analysis Reports tab stays selected while a report is open.
