---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-scaffolder-backend-module': minor
'@openchoreo/openchoreo-client-node': minor
---

Email notification channels can set a sender display name. The create form adds an optional
"Sender Name" field (`emailConfig.fromName`), the scaffolder action forwards it to the OpenChoreo
API, and the channel overview card shows the sender as `Name <address>`. The client is regenerated
for the new `NotificationEmailConfig.fromName` field.
