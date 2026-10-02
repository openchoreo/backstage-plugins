---
'backend': patch
'app': patch
---

Add Microsoft Entra ID (Azure AD) org ingestion. Register `@backstage/plugin-catalog-backend-module-msgraph` in the backend to sync users and groups into the catalog (configured under `catalog.providers.microsoftGraphOrg`), and register `@backstage/plugin-org` in the portal app so User and Group entity pages render their profile, members, and ownership cards.
