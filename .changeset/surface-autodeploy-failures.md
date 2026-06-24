---
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin': minor
---

Surface OpenChoreo controller auto-deploy failures in the Deploy tab. Pre-binding release-generation failures (bad trait, invalid config — from `Component.status.conditions`) now surface on the Setup card and as an error marker on the canvas Set-up tile, instead of leaving the user with no signal. Post-binding render/apply failures (from `ReleaseBinding.status.conditions`) show an actionable error banner with the controller's reason + message in the environment detail panel, instead of a context-free "Failed" badge. Long controller messages are clamped to a compact banner with a "View details" dialog (reason + full message + copy).
