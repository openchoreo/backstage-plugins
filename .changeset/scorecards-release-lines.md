---
'@openchoreo/backstage-plugin-tech-insights-scorecards': minor
'@openchoreo/backstage-plugin': patch
---

Score release lines apart from their component. With
`techInsights.scorecards.variants` set to `{ kind: ReleaseLine, parentKind: Component }`,
a component's tier and checks cover its main line only. Its release lines are
listed under it with their own tiers, in a Release lines card on its Scorecards
tab and in the breakdown, where the component's row counts its lines and
expands to all of them, main first. A release line never changes the tier of its component,
project, namespace or group, and has no row of its own in the breakdown.

A release line's Scorecards tab now scores the line itself and links to its
component, instead of showing the component's scorecard.
