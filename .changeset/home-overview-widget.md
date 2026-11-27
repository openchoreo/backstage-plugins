---
'@openchoreo/backstage-portal-app': minor
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-react': patch
---

Replace the home page's My Projects widget with an Overview widget showing
project, component, active deployment, environment, API and resource counts as
linked tiles.

`MyProjectsWidget` is removed from `@openchoreo/backstage-plugin`; use
`OverviewWidget`. The home widget is now `OpenChoreoOverview` (was
`OpenChoreoMyProjects`), so saved or configured layouts naming the old widget
need updating.

`SummaryWidgetWrapper` gains a `columns` prop that fixes the column count of the
`cards` variant.
