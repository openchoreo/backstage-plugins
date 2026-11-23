# @openchoreo/backstage-plugin-tech-insights-scorecards

## 1.4.0-m.3

### Minor Changes

- 145586f: Publish the Scorecards plugins: the Scorecards frontend plugin, the
  dynamic-checks Tech Insights backend module, and the permissions they share.
  They now release in lockstep with the other `@openchoreo/*` packages.
- 9569e08: Add the Scorecards overview and entity views. The Scorecards page opens with
  the share of published checks passing, with a breakdown by kind and by check.
  Entities get a Scorecards tab with their tier, pass rate and check results, and
  Systems, Domains and Groups roll up the entities that belong to them. A summary
  card for the Overview tab and an `EntityScorecardRankChip` are also included.
- 3b1ea56: Score release lines apart from their component. With
  `techInsights.scorecards.variants` set to `{ kind: ReleaseLine, parentKind: Component }`,
  a component's tier and checks cover its main line only. Its release lines are
  listed under it with their own tiers, in a Release lines card on its Scorecards
  tab and in the breakdown, where the component's row counts its lines and
  expands to all of them, main first. A release line never changes the tier of its component,
  project, namespace or group, and has no row of its own in the breakdown.

  A release line's Scorecards tab now scores the line itself and links to its
  component, instead of showing the component's scorecard.

### Patch Changes

- Updated dependencies [145586f]
  - @openchoreo/backstage-plugin-tech-insights-dynamic-checks-common@1.4.0-m.3
