# @openchoreo/backstage-plugin-tech-insights-scorecards

Scorecards over Backstage Tech Insights: a catalog-wide page with the checks table and editor
(draft, dry-run, publish) and a Data sources panel. Checks are managed through
`@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks`, without a config
change or restart.

## Install

The plugin supports the New Frontend System and frontend feature discovery:

```bash
yarn --cwd packages/app add @openchoreo/backstage-plugin-tech-insights-scorecards
```

Backend: `@backstage-community/plugin-tech-insights-backend`,
`@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks`, and any fact
collector modules, each with a `techInsights.factRetrievers.<id>` schedule.

## Configure

| Extension                       | Config                                                         |
| ------------------------------- | -------------------------------------------------------------- |
| `page:tech-insights-scorecards` | `path` (default `/scorecards`), `title` (default `Scorecards`) |

```yaml
app:
  extensions:
    - page:tech-insights-scorecards:
        config:
          path: /quality
          title: Quality
```

Kind and tier names come from app config, since the check form and the data sources show them.
Kinds without an entry are split into words (`DeploymentPipeline` reads "Deployment pipeline");
the check form's kind picker shows the names and saves the kinds. Text that covers several kinds
uses `entityLabel`, which defaults to "entity" and "entities". Tier names use the maturity
plugin's own keys and default to Stone, Bronze, Silver and Gold:

```yaml
techInsights:
  scorecards:
    kindLabels:
      System: Project
      Domain: Namespace
    entityLabel:
      singular: resource
      plural: resources
  maturity:
    rank:
      bronze: { title: Foundational }
```

Tier colours are adjusted against the theme's paper surface until they reach WCAG AA contrast,
so they read in light and dark themes alike.

The check editor suggests the categories in `categories`, along with any category an existing
check already uses. Authors can still type a new one:

```yaml
techInsights:
  scorecards:
    categories: [Security, Reliability, Documentation]
```

## Turn it off

A host that installs the plugin but switches Scorecards at deploy time sets
`techInsights.scorecards.enabled` to `false`. The page then shows that Scorecards is turned off
and makes no backend calls, so the Tech Insights backend can be left out. Gate the backend
modules on the same key, defaulting to on like the plugin, so the two stay in step:

```yaml
techInsights:
  scorecards:
    enabled: ${SCORECARDS_ENABLED:-false}
```

## Permissions

Check management is guarded by the permissions in
`@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common`. The page needs
`tech-insights.dynamic-check.read`, and disables the actions a user isn't allowed to take; the
backend enforces the same permissions.

A check that can't be evaluated against the facts collected now, for example one that uses a fact
its retriever no longer reports, is marked in the checks table. Publishing it is refused, and a
published one is left out of evaluation instead of failing every other check on the entity.
