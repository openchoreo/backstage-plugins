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
---

Support components with release lines.

- Release lines are synced to the catalog as a new `ReleaseLine` kind, part of their component and visible to whoever can view the component. They are not listed in the catalog viewer or search; they are reached from their component's Overview.
- A component with release lines shows only its Overview and Definition tabs. Its Overview lists the component's release lines, with their environments, latest release and overrides, and a Create ReleaseLine button.
- Each release line has its own page with the component's tabs (build, deploy, logs, metrics, ...) scoped to that line. Its Definition tab edits the properties the line overrides, next to the properties it inherits from the component, which are read-only and edited on the component's Definition page.
- The component creation wizard shows a Declare Release Line step for component types that allow release lines, and creates the component's first line. Component type pages show whether release lines are allowed.
- The project cell diagram shows each release line as its own node (`component:line`), linked to the line a dependency names, with gateway metrics scoped to the line. Clicking a line node opens the line's page.

Components without release lines behave as before.
