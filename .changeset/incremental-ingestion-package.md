---
'@openchoreo/backstage-plugin-catalog-backend-module-openchoreo-incremental': minor
---

Add `@openchoreo/backstage-plugin-catalog-backend-module-openchoreo-incremental`
— a new package providing burst-based, cursor-resumable incremental catalog
ingestion on the namespace model (namespaces → projects → components). The
module is config-gated off by default via
`openchoreo.features.incrementalIngestion.enabled`; when the flag is true the
scheduled full-sync `OpenChoreoEntityProvider` in the sibling catalog module
stands down so entities are not double-ingested. Ingestion state persists
through knex migrations on the plugin database (SQLite in dev, Postgres in
prod), applied lazily on first enable. The package depends on the hardened
`fetchAllPages`-era `@openchoreo/openchoreo-client-node` client (PR-A).
