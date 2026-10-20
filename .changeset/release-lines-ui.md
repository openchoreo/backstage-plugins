---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-scaffolder-backend-module': minor
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

- Release lines are synced to the catalog as a new `ReleaseLine` kind, part of their component and visible to whoever can view the component. They are not listed in the catalog viewer or search; they are reached from their component's Overview.
- A component with release lines shows only its Overview and Definition tabs. Its Overview lists the component's release lines, with their environments, latest release and overrides, and a Create ReleaseLine button.
- Each release line has its own page with the component's tabs (build, deploy, logs, metrics, ...) scoped to that line. Its Definition tab edits the properties the line overrides, next to the properties it inherits from the component, which are read-only and edited on the component's Definition page.
- The component creation wizard shows a Declare Release Line step for component types that allow release lines, and creates the component's first line. Component type pages show whether release lines are allowed.
- The project cell diagram shows each release line as its own node, labelled with the component name and a pill with the line name, linked to the line a dependency names, with gateway metrics scoped to the line. Clicking a line node opens the line's page.
- A release line's Alerts tab and the Deploy tab's active-incident counts are scoped to the line, and alert and incident details show the release line when there is one. The observability API can also scope incidents, DORA metrics and costs to a release line, reporting clearly when the installed FinOps module cannot filter costs by line.
- The Delivery Insights page shows a Release line filter when the selected component has release lines, narrowing the metrics and the per-environment breakdown to one line.

- An RCA report's Incident Overview shows the release line the alert fired on, for components with release lines.
- Workflow runs returned by the workflows backend include their labels, so a run can be matched to its release line.
Components without release lines behave as before.
