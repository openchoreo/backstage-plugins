---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy': minor
'@openchoreo/openchoreo-client-node': minor
'@openchoreo/backstage-design-system': minor
'@openchoreo/backstage-plugin-openchoreo-ci': minor
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/cell-diagram': minor
'@openchoreo/backstage-portal-app': minor
'@openchoreo/backstage-plugin-openchoreo-workflows-backend': patch
---

Support components with release lines.

- Every component has an implicit `default` line, built from the component's own workload and bindings. Its other lines are ReleaseLine resources, synced to the catalog as a new `ReleaseLine` kind, part of their component and visible to whoever can view the component. They are not listed in the catalog viewer or search, and are reached from their component's Overview.
- Components are created as before. When the component type allows release lines, the component's context menu offers Create Release Line. Once a component has a release line, its Overview lists its lines, `default` first, with their environments, latest release and overrides. The component's own tabs work on the default line, which can't be edited, deleted or created, and the name `default` is rejected for a new line.
- Each release line has its own page with the component's tabs (build, deploy, logs, metrics, ...) scoped to that line. Its Definition tab edits the properties the line overrides, next to the properties it inherits from the component, which are read-only and edited on the component's Definition page. Component type pages show whether release lines are allowed.
- The `default` keyword is never written into a resource or request: releases, deploys, workload saves, dependencies and builds for the default line leave the release line empty. A dependency on a component with release lines picks the default line or one of its release lines, the default line unless chosen otherwise.
- The project cell diagram shows the default line and each release line of a component as their own nodes, labelled with the component name and a pill with the line name, with a Release line filter. Dependencies link to the line they name, or to the default line, and gateway metrics are scoped per line. Clicking a line node opens the line's page.
- Runtime logs, events, metrics, alerts, project logs, metrics, traces and incidents, cost insights and cost analysis reports get a Release line filter of All lines, `default` or one line, shown for a component with release lines. On a release line's page they are scoped to the line. Alert and incident details show the release line when there is one, and the observability API reports clearly when the installed FinOps module cannot filter costs by line.
- The Delivery Insights page shows a Release line filter when the selected component has release lines, narrowing the metrics and the per-environment breakdown to `default` or one line.
- An RCA report's Incident Overview shows the release line the alert fired on.
- Cost analysis reports show their line in their overview and in the reports list, and link to the line's page and metrics, or the component's for the default line. Apply Recommendation names the release binding it updates and refuses a binding that belongs to another line.
- Workflow runs returned by the workflows backend include their labels, so a run can be matched to its release line.

Components without release lines behave as before.
