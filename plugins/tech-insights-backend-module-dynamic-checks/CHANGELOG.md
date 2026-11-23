# @openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks

## 1.4.0-m.3

### Minor Changes

- 145586f: Publish the Scorecards plugins: the Scorecards frontend plugin, the
  dynamic-checks Tech Insights backend module, and the permissions they share.
  They now release in lockstep with the other `@openchoreo/*` packages.
- 4808a76: An entity's check results and facts now follow access to the entity. Running
  checks for one entity, and reading its latest facts or their history, answer
  403 when the caller can't read the entity in the catalog. The bulk check run
  lets holders of the dynamic-check read permission through; anyone else must be
  able to read every entity they list.
- 38fc9c9: Add OpenChoreo starter checks behind `techInsights.dynamicChecks.openchoreoStarterChecks`. When
  it's on, 9 published checks on deployment, component type and GitHub facts are added once per
  database, and edits, unpublishing and deletion made afterwards are kept.

### Patch Changes

- 19fcb89: The OpenChoreo starter checks on components also name `ReleaseLine` in their filters, so each
  release line is held to the same checks as its component's main line, judged on its own facts.
- Updated dependencies [145586f]
  - @openchoreo/backstage-plugin-tech-insights-dynamic-checks-common@1.4.0-m.3
