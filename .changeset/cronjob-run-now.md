---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/openchoreo-client-node': minor
---

Add a "Run now" action for scheduled tasks. On components with a cronjob
workload type, the environment detail panel shows "Run now" in place of
"Rollout restart" (which had no effect there) and runs the CronJob once
through the release binding trigger API. It is gated by the same
`releasebinding:update` permission as the other binding actions.
