# @openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks

The dynamic-checks backend module for the tech-insights plugin.

_This plugin was created through the Backstage CLI_

## Starter checks

With `techInsights.dynamicChecks.openchoreoStarterChecks: true`, the module adds the checks an
OpenChoreo portal starts with, published, on top of any checks already stored. They read facts from
the OpenChoreo and GitHub fact retrievers.

```yaml
techInsights:
  dynamicChecks:
    openchoreoStarterChecks: true
```

Each starter check is added once per database and never updated afterwards, so a check that is
edited, unpublished or deleted stays that way across restarts and upgrades. A check already stored
under a starter check's id is kept as it is. With an in-memory database, or SQLite on storage that
doesn't survive a restart, the starter checks come back after every restart, along with losing
every other change.

New starter checks ship as new seed files in `starter-checks/openchoreo/`, which keep their own
migration ledger (`dynamic_checks_openchoreo_starter_migrations`). Turning the option on later
still adds them. Nothing is seeded when `backend.database.migrations.skip` is set.
