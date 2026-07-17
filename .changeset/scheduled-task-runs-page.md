---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
---

Add Runs tab to scheduled-task component entity pages. Renders a Component → Runs (Jobs) → Retries (Pods) → Logs hierarchy over the observer's `/scheduled-tasks/runs/query` and `/scheduled-tasks/runs/{jobName}/retries/query` endpoints. Retries queries are scoped to each run's own lifetime via optional `startTime` / `endTime`, avoiding the observer's per-call event cap on high-frequency CronJobs. Requires the observer backend from openchoreo/openchoreo#3933.
