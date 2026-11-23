---
'@openchoreo/openchoreo-client-node': minor
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Sync the OpenChoreo API spec to openchoreo `12dce69e`.

- **Endpoints:** `spec.visibility` accepts `project`, alongside namespace,
  internal and external (openchoreo#5491).
- **Notification channels:** a webhook's URL can come from a secret
  (`webhookConfig.urlFrom`) instead of `webhookConfig.url`, so `url` is
  optional (openchoreo#5472). The catalog's notification channel entity keeps
  whichever one the channel has.
