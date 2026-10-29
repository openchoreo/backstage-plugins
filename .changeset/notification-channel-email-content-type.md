---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-scaffolder-backend-module': minor
'@openchoreo/openchoreo-client-node': minor
---

Notification channels can send HTML email bodies. The create form exposes the email
template's `contentType` (`text/plain` or `text/html`), the scaffolder action forwards it to the
OpenChoreo API, and the channel overview card shows it. The client is regenerated for the new
`NotificationEmailTemplate.contentType` field.
