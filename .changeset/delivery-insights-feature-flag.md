---
'@openchoreo/backstage-plugin-common': patch
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-portal-app': patch
---

Put the Delivery Insights page behind the `openchoreo.features.deliveryInsights`
flag, off by default. It is a feature preview, and the page has nothing to show
unless the Observer is separately configured to collect the data.
