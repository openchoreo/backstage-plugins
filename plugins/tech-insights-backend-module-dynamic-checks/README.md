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
still adds them. Nothing is seeded when `backend.database.migrations.skip` is set. Never edit,
rename or delete a seed file once it has shipped. Databases that already ran it won't pick up the
edit, and knex refuses to migrate when its ledger names a file that's gone.

## Inherited checks

With `techInsights.dynamicChecks.inheritChecks`, the entities of a kind also run every check that
matches their parent entity. The OpenChoreo portal turns it on so a release line runs its
component's checks.

```yaml
techInsights:
  dynamicChecks:
    inheritChecks:
      - kind: ReleaseLine
        parentField: spec.component
```

`parentField` is the dot path to the field holding the parent's entity ref. A ref without a
namespace resolves in the entity's own namespace.

A check's filter is matched against the parent, with the entity's own kind and name added as second
values. A filter on `kind: Component`, or on a component's type, annotations or name, therefore
covers its release lines, and a filter on `kind: ReleaseLine` still works. The check reads the
entity's own facts, so a release line passes or fails on what was collected for the line, and a
check whose facts aren't collected for it gives no result there. When the parent can't be read, the
entity runs only the checks that match it directly. Dry runs match filters the same way.
