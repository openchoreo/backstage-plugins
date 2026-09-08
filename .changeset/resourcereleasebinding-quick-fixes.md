---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-openchoreo-observability-backend': minor
'@openchoreo/openchoreo-client-node': patch
---

Apply RCA **Quick Fixes** that target a `ResourceReleaseBinding`.

The panel previously sent every change to the Component `releasebindings`
endpoint, so fixes the SRE agent raised against a Resource (e.g. a managed
Postgres starved of memory) failed with `404`.

- **Kind-aware routing**: each change is routed by the report's `target_kind`,
  with a missing value treated as `ReleaseBinding` so older reports keep working.
- **New backend routes**: `GET|PUT /resource-release-binding`, forwarding the
  signed-in user's token so the API enforces `resourcereleasebinding:update`.
- **Grouping**: patches group by binding kind _and_ name, so bindings of
  different kinds sharing a name are no longer merged into one GET/PUT.
- **Scoped edits**: `ResourceReleaseBinding` changes are restricted to fields
  under `spec.resourceTypeEnvironmentConfigs`; env vars and file mounts stay
  exclusive to `ReleaseBinding`.
- **Client**: RCA agent spec resynced from openchoreo `c0e6cd4c` to pick up the
  `target_kind` discriminator.
