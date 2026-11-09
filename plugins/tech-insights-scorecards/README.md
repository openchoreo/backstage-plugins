# @openchoreo/backstage-plugin-tech-insights-scorecards

Scorecards over Backstage Tech Insights: a catalog-wide page with a pass-rate summary and a
breakdown by kind, the checks table and editor (draft, dry-run, publish), and a Data sources
panel; plus a scorecard tab on each entity page. Checks are managed through
`@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks`, without a config
change or restart.

## Install

The plugin supports the New Frontend System and frontend feature discovery:

```bash
yarn --cwd packages/app add @openchoreo/backstage-plugin-tech-insights-scorecards \
  @backstage-community/plugin-tech-insights-maturity
```

The maturity plugin provides the scores API this plugin reads. To hide the maturity plugin's own
views:

```yaml
app:
  extensions:
    - page:tech-insights-maturity: false
    - entity-content:tech-insights-maturity/maturity: false
    - entity-content:tech-insights-maturity/summary: false
    - entity-card:tech-insights-maturity/maturity-summary: false
```

Discovery installs the plugin alone. The maturity plugin's `maturityApiRef` factory ignores
`techInsights.maturity.enableCompoundEntityCheck`; the scorecards views don't depend on that
flag, but a portal whose other `maturityApiRef` users do can add `techInsightsMaturityApiModule`
from `./alpha`, which passes it through.

Backend: `@backstage-community/plugin-tech-insights-backend`,
`@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks`, and any fact
collector modules, each with a `techInsights.factRetrievers.<id>` schedule.

## Configure

| Extension                                      | Config                                                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page:tech-insights-scorecards`                | `path` (default `/scorecards`), `title` (default `Scorecards`), `kinds` (entity kinds scored, default every kind a published check applies to), `showChecks` (default `true`)                         |
| `entity-content:tech-insights-scorecards`      | `title`, `group`, `filter` (default: Component, API, Resource, System, Domain and Group), `icon`. Keep the default `path` (`/scorecards`): the page, the card and the rollups link to it.             |
| `entity-card:tech-insights-scorecards/summary` | A card for the Overview tab with the tier, ring, tier ladder and category bars, linking to the tab. `title`, `filter` (default: System, Domain and Group). Set to `false` to leave scores to the tab. |

```yaml
app:
  extensions:
    - page:tech-insights-scorecards:
        config:
          path: /quality
          title: Quality
          kinds: [Component, API]
    - entity-content:tech-insights-scorecards:
        config:
          title: Quality
          filter:
            kind:
              $in: [Component, API, System]
```

`kinds` should list kinds that checks run against. A kind whose tier only combines what belongs to
it, such as System, has no pass rate of its own, so the page leaves it to the entity's tab. Add every
kind your checks run against to the tab's `filter` too, since the page links scored entities to
the tab.

Set `showChecks: false` when checks aren't stored by the dynamic-checks module, for example when
the portal keeps checks in `app-config` with the upstream jsonfc checker.

Kind and tier names come from app config, since the page, tab, card and check form all show
them. Kinds without an entry are split into words (`DeploymentPipeline` reads "Deployment
pipeline"); the check form's kind picker shows the names and saves the kinds. Text that covers
several kinds, such as "13 of 28 checks pass across 6 entities", uses `entityLabel`, which
defaults to "entity" and "entities". Tier names use the maturity plugin's own keys and default
to Stone, Bronze, Silver and Gold:

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
`techInsights.scorecards.enabled` to `false`. The page and entity tab then show that Scorecards
is turned off, the summary card disappears, and nothing calls the backend, so the Tech Insights
backend can be left out. Gate the backend modules on the same key, defaulting to on like the
plugin, so the two stay in step:

```yaml
techInsights:
  scorecards:
    enabled: ${SCORECARDS_ENABLED:-false}
```

## Permissions

Check management is guarded by the permissions in
`@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common`. The page needs
`tech-insights.dynamic-check.read` when it shows checks, and disables the actions a user isn't
allowed to take; the backend enforces the same permissions. With `showChecks: false` the page
doesn't require that permission, and the scores it shows are subject to tech-insights' own.

A check that can't be evaluated against the facts collected now, for example one that uses a fact
its retriever no longer reports, is marked in the checks table. Publishing it is refused, and a
published one is left out of evaluation instead of failing every other check on the entity.
